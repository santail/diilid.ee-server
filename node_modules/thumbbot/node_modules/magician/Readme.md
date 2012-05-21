
# magician

  Library for **easy** image manipulation. Requires ImageMagick.

# Here it is!

```

                        sMy://///////////////////////////////////:sMh`                                                     
                        .mN+//////////////////////////////////////mN-                                                      
                         +Mh/////////////////////////////////////sMs                                                       
                         `dN+////////////////////////////////////mN-                                                       
           ``````         +Mh///////////////////////////////////sMs                                                        
        ```......```      .mN+//////////////////////////////////mN-                                                        
       ``.-:+ooo/-..``     oMy:////////////////////////////////oMh                                                         
      ``.-/y+::/oy:..`     -Nm/////////////////////////////////dM/                                                         
      ``.-oy-:/:-d/-.``    `hMo://////////////////////////////+Nm.                                                         
      ``.-:sso+oyo-.``      +Mh//////////////////////////////:sMs                                                          
       ``..-+yoso-.``       .mN//++ossyyyyyyyyyyyyyyyyyyyyyssodN/                                                          
  `:/:-.````:dsyy```        `hMdyyso+//:::-----------::://++oyNm.                   `.-:/:`                                
  :msosyyso+oNyhd.`          oMy::::------........------:::::oNh`          ``.-:/+osyysosm:                                
  `oho////++oNhhNysso+//:--../Md/:::------.........-----::::/yMs..--://+ossyyysoo++////oho`                                
    -oyysso++mdyNo/+++oosssyyyddhyyyyssssooooooooooossssyyyyhddyyysssoo++////////+ossyyo-                                  
      `.-:/osmdyNhoo++/////////////++++++++++ooo++++++++++/////////////++oossyysso/:-.`                                    
            `smymy/+oossyyyyyssooo+++++++/////////////+++++ooosssyyyydmso+/:-.``                                           
             +Nymy     `.omdhyyhmmhssssyy+++yyyyyyy+:-/syooooyds//:--+dh`                                                  
             :Nydd      om+--:/-::-...::`:o/`:/..+..sy+`::....--ooh:..oN-                                                  
             -Nyhm`    `dd../ho/......+.`hNh`.+..+`.hdo`:/.....--oy-./dh`                                                  
             .mhhN.     +N+.-o-.......-/-.---/:--:/-.--::........::/yds:++o/                                               
           `--ddyN/`    `+dy/...........-:::::osso:::/:--.........sNo.`s+--h:--:/++.                                       
          .y///+dNhy+`    .yN:........-/ydddmmmmmmmmmmmmh+-.......hd`  -y..+ms////yo.`                                     
         `:hyyyhhNy+dh:`   -Ns......../NMMMMMMMMMMMMMMMMMm/....../N+   `ds+sooshsso+so`                                    
         so///yNymo///yh/.``sm:.......-/+ssydmNNNNNmhss++:....../my``-+hm:-.../yoooosss.                                   
         /hyyydNyddoosmyhhy/:hm/........./:odmmmmmmmd:/:......-omy:+yhyym:.....-ys//+oy-                                   
         so:::yMyhm-.ydsssshhmmdy/-.......-:////////:--....-:odhmdhyssssmo.....-yyso+ss                                    
         `/hhyyddhN:omysssssohd/ohhyo/:---------------::/oyhhs//myossssoym/....:hoo+++:                                    
          .h/::/dhNmmyssssssssdy-.:+oyhhddddhdddddddmmdyyo/:-.-hdssssssssyms/::+ys.                                        
           `-::hmyNdhhyssssssssms-....../NmdmdmNNdddmm:......-ydssssssssyhhs+o+/.                                          
               omymo`:ohhyssssssmy--....-mmdddmymmddNd.....-:hdssssssyhho-`                                                
      ``...----oNymh---:+sddysssshdys/..-dmhhhy+shhhmh.../sydhsssshdhs:-..````````                                         
     `-::::::::oNydd:::::::oNssssssymo..-hh+++++++++dy...smysssssyN+:::::::::::::::::--.`                                  
       `.::::::+Nhdm/::::::+Nyssssym/...-hh+++++++++dy....+msssssyN/:::::::::::::::::::-.                                  
          `-:::/osoo:::::::+Nsssssms....-dh+++++++++dy.....ydssssyN/::::::::::::::::-`                                     
             .-::::::::::::oNssssyN:....-dy+++++++++hh...../NsssssN+:::::::::::::-`                                        
               `.::::::::::ymsssohd-....-ms+++++++++hd.....-myosssNo::::::::::-.                                           
                  .::::::::ddossodh-....:No+++++++++ym-....-dhossomy::::::::-`

```


# Installation

```npm install magician```

# Dependencies

The main dependency is ImageMagick. convert and identify command-line tools, in fact. If you are happy user of Mac, you can install ImageMagick using HomeBrew:

```brew install imagemagick```

# Features

This is very early release, so Magician does not have a lot of features.

* Resizing images
* Cropping images
* Getting dimensions of an image

# Usage

```
Magician = require 'magician'

image = new Magician "#{ __dirname }/source.jpg", "#{ __dirname }/target.jpg"

image.resize width: 100, height: 100, (err) ->
	// done!
	
image.crop x: 0, y: 0, width: 200, height: 100, (err) ->
	// done!

image.convert (err) ->
	// convert from source format to target format

image.getDimensions (err, dimensions) ->
	width = dimensions.width
	height = dimensions.height
```

# Tests

You can run tests using mocha:

```
mocha
```

Don't forget to install development dependencies first:

```
npm install --development
```

# TODO List

* Resizing using ratio
* Improve test for convert() method
* Blurring image
* getting base64 encoded content of image for data:URIs

# License 

(The MIT License)

Copyright (c) 2011 Vadim Demedes &lt;sbioko@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.