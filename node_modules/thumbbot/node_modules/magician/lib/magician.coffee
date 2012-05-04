exec = require("child_process").exec

class Magician
	
	constructor: (@sourcePath, @destPath) ->
	
	resizeTo: (width, height, callback) ->
		if not width or width < 0 or not height or height < 0
			return callback new Error "width and height should be bigger than 0"
		
		exec "convert -resize #{ width }x#{ height } #{ @sourcePath } #{ @destPath }", (err) ->
			callback err if callback
	
	cropFrom: (x, y, width, height, callback) ->
		if x < 0 or y < 0 or width < 0 or height < 0
			return callback new Error "x, y, width and height should be bigger than 0"
		exec "convert #{ @sourcePath } -crop #{ width }x#{ height }+#{ x }+#{ y } #{ @destPath }", (err) ->
			callback err if callback
	
	convert: (callback) ->
		exec "convert #{ @sourcePath } #{ @destPath }", (err) ->
			callback err if callback
		
	
	getDimensions: (callback) ->
		that = @
		exec "identify #{ @sourcePath }", (err, stdout) ->
			dimensions = stdout.split(" ")[2].split "x"
			that.width = dimensions[0]
			that.height = dimensions[1]
			callback err, {
				width: that.width,
				height: that.height
			} if callback
			
			
module.exports = Magician