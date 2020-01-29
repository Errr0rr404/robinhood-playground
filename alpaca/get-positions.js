const { alpaca } = require('.');
const getStSentiment = require('../utils/get-stocktwits-sentiment');
const { avgArray } = require('../utils/array-math');
const getTrend = require('../utils/get-trend');
const Holds = require('../models/Holds');
const Pick = require('../models/Pick');
const getMinutesFromOpen = require('../utils/get-minutes-from-open');
const analyzePosition = require('../analysis/positions/analyze-position');
const { sellBelow = {}, sellAbove = {}, force: { keep }, continueDownForDays } = require('../settings');

const checkForHugeDrop = position => {
  let { currentPrice, returnPerc: actualReturnPerc, avgEntry: actualEntry, buys = [], ticker } = position;
  const dropIndex = buys.slice().reverse().findIndex((buy, index, arr) => {
    const isBigDrop = arr[index + 1] && buy.fillPrice < arr[index + 1].fillPrice * .7;
    const isNotToday = buy.date !== (new Date()).toLocaleDateString().split('/').join('-');
		return isBigDrop && isNotToday;
  });
  if (dropIndex !== -1) {
    if (ticker === 'FCEL') {
      strlog({
        ticker,
        dropIndex,
      })
    }
    const avgEntry = avgArray(
      buys.slice(dropIndex).map(buy => buy.fillPrice)
    );
    return {
      dropIndex,
      avgEntry,
      returnPerc: getTrend(currentPrice, avgEntry),
      actualEntry,
      actualReturnPerc,
    };
  }
};


module.exports = async (
  skipStSent = false
) => {

  const min = getMinutesFromOpen();

  const uniqDates = [
    (new Date()).toLocaleDateString().split('/').join('-'),
    ...(await Pick.getUniqueDates()).reverse()
  ].uniq();

  console.log({
    uniqDates
  })
  const getDaysOld = date => {
    return uniqDates.indexOf(date);
  };
  strlog({ uniqDates })
  
  let positions = (await alpaca.getPositions());
  strlog({ positions })
  positions = positions.map(({ 
    symbol, 
    avg_entry_price, 
    qty, 
    unrealized_pl, 
    unrealized_plpc, 
    current_price,
    ...rest 
  }) => ({
    ticker: symbol,
    avgEntry: avg_entry_price,
    quantity: qty,
    returnPerc: unrealized_plpc * 100,
    unrealizedPl: Number(unrealized_pl),
    currentPrice: Number(current_price),
    ...rest
  }));

  positions = await mapLimit(positions, 3, async position => {
    const { ticker } = position;
    const hold = await Holds.findOne({ ticker }).lean() || {};
    if (!hold.buys) {
      console.log('hey! no buys?', ticker);
    }
    const { buys = [] } = hold;


    const buyStrategies = buys.map(buy => buy.strategy).reduce((acc, strategy) => ({
      ...acc,
      [strategy]: (acc[strategy] || 0) + 1
    }), {});


    const [daysOld, mostRecentPurchase] = buys.length >= 1 ? [
      buys[0],
      buys[buys.length - 1]
    ].map(buy => getDaysOld(buy.date)) : [0, 0];

    // strlog({ buys});

    const DONTSELL = [
      'KEG',
      'TCON',
      'ASLN',
      'SFET'
    ];

    const wouldBeDayTrade = DONTSELL.includes(ticker) || Boolean(mostRecentPurchase === 0);
    return {
      ...position,
      ...hold,
      buyStrategies,
      daysOld,
      mostRecentPurchase,
      wouldBeDayTrade,
      ...!skipStSent && {
        stSent: await getStSentiment(ticker) || {}
      }
    };
  });

  positions = positions.map(position => ({
    ...position,
    ...checkForHugeDrop(position)
  }));

  positions = positions.map(position => {
    const { 
      stSent: { upperLimit, lowerLimit } = {},
      returnPerc
    } = position;
    return {
      ...position,
      outsideBracket: Boolean(returnPerc >= upperLimit || returnPerc <= lowerLimit)
    };
  });

  const ratioDayPast = 0.2 || Math.max(0.2, Math.min(min / 360, 1));
  strlog({ ratioDayPast })


  const withAnalysis = await mapLimit(positions, 2, async position => 
    position.buys ? {
      ...position,
      ...await analyzePosition(position)
    } : position
  );

  const calcNotSelling = ({ ticker, currentPrice }) => {
    const options = { 
      [`is above sellBelow`]: currentPrice > sellBelow[ticker],  // nothing greater than undefined,
      [`is below sellAbove`]: currentPrice < sellAbove[ticker],   // false if undefined
      onKeeperList: keep.includes(ticker)
    };
    return (
      Object.entries(options)
        .filter(([_, isTrue]) => isTrue)
        .shift() 
      || [false]
    ) [0];
  };


  const getPercToSell = position => {

    let { 
      daysOld, 
      returnPerc, 
      outsideBracket, 
      wouldBeDayTrade, 
      ticker, 
      market_value, 
      unrealized_intraday_plpc,
      notSelling,
      stSent: { stBracket } = {}
    } = position;

    if (notSelling) return 0;

    if (daysOld >= 3 && market_value < 30) {
      return 100;
    }

    // if (min > 150 && Number(unrealized_intraday_plpc) * 100 < -6 && Number(unrealized_intraday_plpc) * 100 > -30) {
    //   return 35;
    // }

    if (Math.abs(returnPerc) < 5) {
      return 0;
    }
    
    // synonymous with prev
    // if (min < 50 && returnPerc < -4) {
    //   return 0;
    // }


    // if (wouldBeDayTrade) return null;
    if (min < 20 && returnPerc > 20) return 50;
    if (Math.abs(returnPerc) > 30) return 24;


    if (daysOld <= continueDownForDays * 2 && returnPerc < 3 + daysOld * 2) {
      return 0;
    }


    // basePerc = dayVal + returnVal
    const dayVal = (daysOld + 1) * 4;
    const returnVal = Math.abs(returnPerc) / 3;
    const basePercent = dayVal + returnVal;

    // shouldVal is based on intraday pl
    const intraDayPl = Number(unrealized_intraday_plpc);
    const weightedIntraday = intraDayPl < 0 
      ? intraDayPl * 2  // cut losses quickly let winners run
      : intraDayPl;

    let shouldVal = Math.abs(weightedIntraday) * 100;
    if (outsideBracket) {
      shouldVal += returnPerc ? 4 : 28;
    }
    // subtract perc if looking good?
    const stBracketNumbers = {
      bullish: 0.5,
      neutral: 0.8
    };
    const stOffset = stBracketNumbers[stBracket] || 1;
    // slow down if perc to sell is bullish
    const summed = (basePercent + shouldVal) * stOffset;

    const halfSum = summed * .5;
    const weightedByDayInProgress = halfSum + ratioDayPast * halfSum;

    const RAND_VARY_PERC = 3;
    const randomized = weightedByDayInProgress + (Math.random() * RAND_VARY_PERC) - (RAND_VARY_PERC / 2);

    strlog({
      ticker,
      wouldBeDayTrade,
      basePercent,
      shouldVal,
      summed,
      halfSum,
      weightedByDayInProgress,
      randomized,
    });

    return +randomized.toFixed(2);
  };

  const getRecommendation = position => {
    const { returnPerc, outsideBracket, wouldBeDayTrade } = position;
    if (!outsideBracket) {
      return '---';
    }
    const action = (returnPerc > 0) ? 'take profit' : 'cut your losses';
    return wouldBeDayTrade ? `possibly ${action}` : action;
  };

  const withNotSelling = withAnalysis.map(position => ({
    ...position,
    notSelling: calcNotSelling(position)
  }));

  const withRecommendations = withNotSelling.map(position => ({
    ...position,
    recommendation: getRecommendation(position),
    percToSell: getPercToSell(position)
  }));


  

  return withRecommendations;

};