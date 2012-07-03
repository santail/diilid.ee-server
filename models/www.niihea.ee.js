//if (site === 'www.niihea.ee') {
//    $('div.images img').each(function (i, image) {
//        pictures.push({
//            url: $(image).attr('src')
//        })
//    })
//
//    $('div.gallery a').each(function (i, link) {
//        pictures.push({
//            url: $(link).attr('href')
//        })
//        $(link).remove()
//    })
//
//    _.extend(price, {
//        discount: $('div.content.bigoffer div.pricetag > div.amount').text()
//        , regular: $('div.content.bigoffer div.pricetag > div.savings').text()
//    })
//
//    deal.exposed = ''
//    deal.end = ''
//
//    _.extend(title, {
//        full: $('div.content.bigoffer div.title > div.inner').text()
//        , short: $('div.content.bigoffer div.title > div.inner').text()
//    })
//
//    deal.seller = {
//        info: $('div.content.bigoffer div.col2').html()
//    }
//
//    _.extend(description, {
//        full: $('div.content.bigoffer div.col3 div').eq(0).html()
//        , map: $('#show_map > a > img').attr('src')
//    })
//}

function template($) {
    return {
        pictures: {
            main: $('div.images img')
            , other: $('div.gallery a')
        }
        , price: {
            discount: $('div.content.bigoffer div.pricetag > div.amount').text()
            , regular: $('div.content.bigoffer div.pricetag > div.savings').text()
        }
        , title: {
            full: $('div.content.bigoffer div.title > div.inner').text()
        }
        , seller: {
            info: $('div.content.bigoffer div.col2').html()
        }
        , description: {
            full: $('div.content.bigoffer div.col3 div').eq(0).html()
            , map: $('#show_map > a > img').attr('src')
        }
    }
}