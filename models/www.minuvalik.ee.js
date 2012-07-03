//if (site === 'www.minuvalik.ee') {
//    pictures.push({
//        url: $('#form_block table').eq(1).find('td').eq(0).children('img').attr('src')
//        , main: true
//    })
//
//    $('#form_block > div').eq(2).children('div').eq(0).children('img').each(function (i, image) {
//        pictures.push({
//            url: $(image).attr('src')
//        })
//        $(image).remove()
//    })
//
//    _.extend(price, {
//        discount: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(0).text(),
//        regular: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(6).text(),
//        percent: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(7).text(),
//        benefit: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(8).text()
//    })
//
//    deal.exposed = ''
//    deal.end = ''
//
//    _.extend(title, {
//        full: $('#form_block > div').eq(0).text(),
//        short: $('#form_block > div').eq(0).text()
//    })
//
//    deal.seller = {
//        info: $('#form_block > div').eq(1).html()
//    }
//
//    _.extend(description, {
//        full: $('#form_block > div').eq(2).children('div').eq(0).html()
//        , map: $('#show_map > a > img').attr('src')
//    })
//}

function template($) {
    return {
        pictures: {
            main: $('#form_block table').eq(1).find('td').eq(0).children('img').attr('src')
            , other: $('#form_block > div').eq(2).children('div').eq(0).children('img')
        }
        , price: {
            discount: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(0).text(),
            regular: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(6).text(),
            percent: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(7).text(),
            benefit: $('#form_block table').eq(1).find('td').eq(1).children('div').children('div').eq(8).text()
        }
        , title: {
            full: $('#form_block > div').eq(0).text(),
            short: $('#form_block > div').eq(0).text()
        }
        , seller: {
            info: $('#form_block > div').eq(1).html()
        }
        , description: {
            full: $('#form_block > div').eq(2).children('div').eq(0).html()
            , map: $('#show_map > a > img').attr('src')
        }
    }
}