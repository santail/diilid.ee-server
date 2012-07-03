//if (site === 'www.ediilid.ee') {
//    $('.leftSide .box1 .mainOfferTitleArea > p > span').remove()
//
//    deal.title = {
//        full: $('.leftSide .box1 .mainOfferTitleArea > p').text()
//        , short: $('.leftSide .box1 .mainOfferTitleArea > p').text()
//    }
//}

function template($) {
    return {
        title: {
            full: $('.leftSide .box1 .mainOfferTitleArea > p').text()
        }
    }
}