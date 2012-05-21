{exec} = require 'child_process'

class Magician
	
	constructor: (@srcPath, @destPath) ->
	    # making paths correct for exec, test folder/test.png => "test folder/test.png"
	    @srcPath = '"' + @srcPath + '"'
	    @destPath = '"' + @destPath + '"'
	
	resize: (options, callback) ->
	    if not options.width or options.width < 0 or not options.height or options.height < 0
	        return callback new Error "width and height should be bigger than 0"
	    
	    exec "convert -resize #{ options.width }x#{ options.height }! #{ @srcPath } #{ @destPath }", (err) ->
	        callback err if callback
	
	resizeTo: (width, height, callback) -> # backwards compatability, to be removed
		@resize width: width, height: height, callback
	
	crop: (options, callback) ->
	    options.x = 0 if not options.x
	    options.y = 0 if not options.y
	    
	    if options.x < 0 or options.y or options.width < 0 or options.height < 0
	        return callback new Error "x, y should be bigger than -1; width and height should be bigger than 0"
	    
	    exec "convert #{ @srcPath } -crop #{ options.width }x#{ options.height }+#{ options.x }+#{ options.y } #{ @destPath }", (err) ->
	        callback err if callback
	
	cropFrom: (x, y, width, height, callback) -> # backwards compatability, to be removed
		@crop x: x, y: y, width: width, height: height, callback
	
	convert: (callback) ->
		exec "convert #{ @srcPath } #{ @destPath }", (err) ->
			callback err if callback
	
	getDimensions: (callback) ->
		that = @
		
		exec "identify #{ @srcPath }", (err, stdout) ->
		    return callback err if err
		    
		    [width, height] = stdout.split(" ")[2].split "x"
		    that.width = parseInt width
		    that.height = parseInt height
		    callback no, width: that.width, height: that.height if callback

module.exports = Magician