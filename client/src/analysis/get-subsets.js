const notWatchout = ({ interestingWords }) => !interestingWords.includes('watchout');
const bearish = ({ interestingWords }) => interestingWords.includes('bearish');
const notStraightDowner = ({ interestingWords }) => interestingWords.every(word => !word.startsWith('straightDown'));

const minorJump = ({ interestingWords }) => interestingWords.includes('minorJump');
const mediumJump = ({ interestingWords }) => interestingWords.includes('mediumJump');
const majorJump = ({ interestingWords }) => interestingWords.includes('majorJump');


const lunch = ({ interestingWords }) => interestingWords.includes('lunch');
const oneToTwo = ({ interestingWords }) => interestingWords.includes('oneToTwo');

const spread1 = ({ interestingWords }) => interestingWords.includes('spread1');
export default positions => {

  const allWords = positions.map(pos => pos.interestingWords).flatten().uniq();
  console.log({ allWords})


  const allDates = positions.map(pos => pos.date).uniq().filter(Boolean);
  const lastFive = allDates.slice(0, 5);
  return {
    allPositions: () => true,
    noAfterhours: ({ interestingWords }) => !interestingWords.includes('afterhours'),
    withoutKEG: ({ ticker }) => ticker !== 'KEG',
    withoutASLN: ({ ticker }) => ticker !== 'ASLN',
    lastFive: ({ date }) => lastFive.includes(date),
    yesterday: ({ date }) => allDates[1] === date,
    today: ({ date }) => allDates[0] === date,
    watchout: ({ interestingWords }) => interestingWords.includes('watchout'),
    notWatchout,
    bullish: ({ interestingWords }) => interestingWords.includes('bullish'),
    neutral: ({ interestingWords }) => interestingWords.includes('neutral'),
    bearish,
    majorJump,
    mediumJump,
    minorJump,
    medOrMajJump: p => mediumJump(p) || majorJump(p),
    onlyMinorJump: p => minorJump(p) && !mediumJump(p) && !majorJump(p),
    onlyMinorJumpNotSpread1: p => minorJump(p) && !mediumJump(p) && !majorJump(p) && !spread1(p),
    singleMultiplier: ({ numMultipliers }) => numMultipliers === 1,
    multipleMultipliers: ({ numMultipliers }) => numMultipliers > 1,
    singlePick: ({ numPicks }) => numPicks === 1,
    multiplePicks: ({ numPicks }) => numPicks > 1,
    notWatchoutMajorJump: position => notWatchout(position) && majorJump(position),
    // notWatchoutMajorJumpNotStraightDowner: position => notWatchout(position) && majorJump(position) && notStraightDowner(position),
    straightDowner: ({ interestingWords }) => interestingWords.some(val => val.startsWith('straightDown')),
    straightDown30: ({ interestingWords }) => interestingWords.some(val => val.startsWith('straightDown30')),
    straightDown60: ({ interestingWords }) => interestingWords.some(val => val.startsWith('straightDown60')),
    straightDown120: ({ interestingWords }) => interestingWords.some(val => val.startsWith('straightDown120')),
    notStraightDowner,
    straightDowner: ({ interestingWords }) => interestingWords.some(val => val.startsWith('straightDown')),
    firstAlert: ({ interestingWords }) => interestingWords.includes('firstAlert'),
    notFirstAlert: ({ interestingWords }) => !interestingWords.includes('firstAlert'),
    avgh: ({ interestingWords }) => interestingWords.some(val => val.startsWith('avgh')),
    notAvgh: ({ interestingWords }) => !interestingWords.some(val => val.startsWith('avgh')),
    hotSt: ({ interestingWords }) => interestingWords.includes('hotSt'),
    notHotSt: ({ interestingWords }) => !interestingWords.includes('hotSt'),
    // collections
    zeroToOne: ({ interestingWords }) => interestingWords.includes('zeroToOne'),
    oneToTwo,
    fitty: ({ interestingWords }) => interestingWords.includes('fitty'),
    lowVolFitty: ({ interestingWords }) => interestingWords.includes('lowVolFitty'),
    fiveToTen: ({ interestingWords }) => interestingWords.includes('fiveToTen'),
  
    // minKey
    initial: ({ interestingWords }) => interestingWords.includes('initial'),
    brunch: ({ interestingWords }) => interestingWords.includes('brunch'),
    lunch,
    dinner: ({ interestingWords }) => interestingWords.includes('dinner'),
    afterhours: ({ interestingWords }) => interestingWords.includes('afterhours'),
  
    // combos
    oneToTwoAndLunch: p => lunch(p) && oneToTwo(p),
    overnightDrops: ({ interestingWords }) => interestingWords.includes('overnight'),
    
    // spread
    spread1,
    spread2: ({ interestingWords }) => interestingWords.includes('spread2'),
    spread3: ({ interestingWords }) => interestingWords.includes('spread3'),
    spread4: ({ interestingWords }) => interestingWords.includes('spread4'),
    spread5: ({ interestingWords }) => interestingWords.includes('spread5'),
    spread6: ({ interestingWords }) => interestingWords.includes('spread6'),

    // downs
    down10: ({ interestingWords }) => interestingWords.includes('down10'),
    down15: ({ interestingWords }) => interestingWords.includes('down15'),
    down20: ({ interestingWords }) => interestingWords.includes('down20'),
    down30: ({ interestingWords }) => interestingWords.includes('down30'),
    down40: ({ interestingWords }) => interestingWords.includes('down40'),
    notDown: ({ interestingWords }) => interestingWords.includes('!down'),

  };
};
