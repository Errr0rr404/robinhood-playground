module.exports = async (ticker, side) => {
    console.log({ ticker, side})
    const { alpaca } = require('.');
    const orders = await alpaca.getOrders({
        status: 'open'
    });
    // str({ orders })

    const matchingOrders = orders.filter(order => {
        return (
            (order.symbol === ticker || ticker === undefined) &&
            (order.side === side || side === undefined)
        );
    });
    str({ matchingOrders })
    for (let order of matchingOrders) {
        log(await alpaca.cancelOrder(order.id));
    }
};