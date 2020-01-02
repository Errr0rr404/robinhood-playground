const INITIAL_TIMEOUT = 16 * 1000;      // 10 seconds
const END_AFTER = 2 * 1000 * 60 * 60;   // 2 hr

const getMinutesFromOpen = require('./get-minutes-from-open');
const lookup = require('./lookup');
const getTrend = require('./get-trend');
// const { avgArray } = require('./array-math');
const alpacaLimitSell = require('../alpaca/limit-sell');
const { alpaca } = require('../alpaca');
const sendEmail = require('./send-email');

module.exports = class PositionWatcher {
  constructor({ 
    ticker,
    initialTimeout = INITIAL_TIMEOUT,
    avgDownCount = 0,
  }) {
    Object.assign(this, {
      ticker,
      avgDownCount,
      timeout: initialTimeout,
      pendingSale: false
    });
    console.log('hey whats up from here')
    this.start();
  }
  start() {
    this.running = true;
    this.startTime = Date.now();
    this.observe();
  }
  getRelatedPosition() {
    const { ticker } = this;
    const stratManager = require('../socket-server/strat-manager');
    return stratManager.positions.alpaca.find(pos => pos.ticker === ticker) || {};
  }
  async observe(isBeforeClose) {

    const shouldStopReason = this.shouldStop();
    if (shouldStopReason) {
      console.log(`stopping because ${shouldStopReason}`)
      this.running = false;
      return;
    }

    const {
      ticker,
      avgDownCount,
      pendingSale
    } = this;

    const {
      avgEntry,
      market_value,
      quantity
    } = this.getRelatedPosition();

    const l = await lookup(ticker);
    strlog({ ticker, l })
    const { currentPrice, askPrice } = l;
    const observePrice =  Math.max(currentPrice, askPrice);
    const trendPerc = getTrend(observePrice, avgEntry);

    strlog({
      avgBuy,
      currentPrice,
      askPrice,
      observePrice
    });
    console.log(`AVG-DOWNER: ${ticker} observed at ${observePrice} ... avg buy at ${avgEntry}, and avg down count ${avgDownCount}... trended ${trendPerc}`);
    if (trendPerc < -4) {
      this.avgDownCount++;
      const realtimeRunner = require('../realtime/RealtimeRunner');
      await realtimeRunner.handlePick({
        strategyName: 'avg-downer',
        ticker,
        keys: {
          [`${avgDownCount}count`]: true,
          [this.getMinKey()]: true,
          isBeforeClose
        },
        data: {
          trendPerc,
        }
      }, true);
    } else if (!pendingSale && trendPerc > 15) {
      const account = await alpaca.getAccount();
      const { portfolio_value, daytrade_count } = account;
      if (Number(market_value) > Number(portfolio_value) * 0.5) {
        if (daytrade_count <= 2) {
          await sendEmail(`Selling ${ticker} using a daytrade can we get 20% up?`);
          const firstChunk = Math.round(Number(quantity) / 2);
          const secondChunk = Number(quantity) - firstChunk;
          alpacaLimitSell({
            ticker,
            quantity: firstChunk,
            limitPrice: avgEntry * 1.2,
            timeoutSeconds: 60 * 20,
            fallbackToMarket: false
          });
          alpacaLimitSell({
            ticker,
            quantity: secondChunk,
            limitPrice: avgEntry * 1.25,
            timeoutSeconds: 60 * 20,
            fallbackToMarket: false
          });
          this.pendingSale = true;
        } else {
          await sendEmail(`You are at three daytrades but you might want to take a look at ${ticker}`);
        }
      }
      

    }

    this.scheduleTimeout();
  }
  shouldStop() {
    return Object.entries({
      notRunning: !this.running,
      hitEndAfter: this.timeout > END_AFTER,
      marketClosed: getMinutesFromOpen() > 390
    }).filter(([reason, boolean]) => boolean).map(([ reason ]) => reason).shift();
  }
  stop() {
    this.running = false;
  }
  scheduleTimeout() {
    console.log(`observing again in ${this.timeout / 1000} seconds (${(new Date(Date.now() + this.timeout).toLocaleTimeString())})`)
    this.TO = setTimeout(() => this.running && this.observe(), this.timeout);
    this.timeout = Math.min(this.timeout * 2, 1000 * 60 * 6);
  }
  newBuy() {
    this.timeout = INITIAL_TIMEOUT;
    clearTimeout(this.TO);
    this.TO = null;
    this.running = true;
    this.observe();
  }
  getMinKey() {
    if (!this.startTime) return null;
    const msPast = Date.now() - this.startTime;
    const minPast = Math.floor(msPast / 60000);
    const minKeys = [1, 5, 10, 30, 60, 120];
    const foundMinKey = minKeys.find(min => minPast < min);
    return foundMinKey ? `under${foundMinKey}min` : 'gt120min';
  }
}