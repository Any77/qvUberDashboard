var gm = require('googlemaps');
var util = require('util');

gm.config('key', 'AIzaSyBXxGUQW5W2OLFCOEbb-vdFXFWaZ-XzzOs');
gm.directions('51.515675951,-0.089294426', '51.513436264,-0.137885325' , 
function(err, data){util.puts(JSON.stringify(data));});