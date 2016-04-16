var fs = require('fs');
var path = require('path');
var url = require('url');
var _ = require('underscore');
var async = require('async');
var request = require('request');
var cheerio = require('cheerio');
var moment = require('moment');
//var iconv = require('iconv-lite');

var fs = require('fs');

var request = request.defaults({
  jar: true
});

var encoding = 'UTF-8';


var logStream = fs.createWriteStream(process.argv[1].replace('app.js','out/log.txt'));	   

var args = process.argv.slice(2);

var splits={};

var CONCURRENCY = 3; //number of threads to get trip details
var MAX_PAGES_ANALYZED=100; //max. number of trip pages analyzed (extract process stops when no more trips found after dichotomic search)

var LOGIN_URL = 'https://login.uber.com/login';
var CAR_MAP = {
  'uberx': 'UberX',
  'suv': 'UberSUV',
  'black': 'UberBlack',
  'uberblack': 'UberBlack',
  'taxi': 'Taxi'
};

console.log("\nRequesting login page...");
logStream.write("Requesting login page...\n");

request(LOGIN_URL, function(err, res, body) {
  //var bodyEncoded = iconv.decode(body,encoding);	
  
  var $ = cheerio.load(body);
  var csrf = $('[name=_csrf_token]').val();
  
  var username=args[0];
  var password=args[1];
  if (args.length <2)
  {
		console.log("\nError! Username and password must be provided.");
		logStream.write("\nError! Username and password must be provided.\n");
		return false;
  }

  return login(username, password, csrf);
});

var login = function(user, pass, csrf) {
  var form = {
    'email': user,
    'password': pass,
    '_csrf_token': csrf,
    'redirect_to': 'riders',
    'redirect_url': 'https://riders.uber.com/trips',
    'request_source': 'www.uber.com'
  };

  console.log("\nLogging in as " + user+"...");
  logStream.write("\nLogging in as " + user+"...\n");
  
  return request.post(LOGIN_URL, {
    form: form
  }, function(err, res, body) {
    if (err) {
      throw err;
    }

    var redirectUrl = 'https://riders.uber.com/trips';
    return request(redirectUrl, function(err) {
      if (err) {
		  logStream.write("Error: " + err+"\n");
        throw err;
      }
	  
	  if (this.path.indexOf('login') > 0)
	  {
		  console.log("\nAuthentication failed :(\nInvalid email or password.");
		  logStream.write("\nAuthentication failed :(\nInvalid email or password.\n");
		  return false;
	  }
	  else 
	  {
		 console.log("\nCool, logged in :)");
		 logStream.write("\nCool, logged in :)\n");
		 return getNumPagesToGet();
	  }
	

    });
  });
};

var requestTripList = function(page, cb) {
  var listUrl = "https://riders.uber.com/trips?page=" + page;
  var options = {
    url: listUrl,
    headers: {
      'x-ajax-replace': true
    }
  };

  console.log("Fetching", listUrl);
  logStream.write("Fetching "+ listUrl+"\n");

  return request(options, function(err, res, body) {
	return cb(err, body);
  });
};

var getNumPagesToGet=function() {
	var tmpPagesToGet=[];
	
	for (i=MAX_PAGES_ANALYZED;i>0;i=Math.floor(i/2))
	{
		tmpPagesToGet.push(i);
	}
	
	console.log("\nFinding out how many pages we've to read...\n");
	logStream.write("\nFinding out how many pages we've to read...\n");
	
	return async.mapLimit(tmpPagesToGet, CONCURRENCY, requestTripList, function(err, result) {
		var combined = result.join(' ');
		var $ = cheerio.load(combined);
		
		var numPages=15; //def falue	
		var tmpNumPages=1;
		
		for(var i=0;i<$(result).length;i++)
		{
			var row=$(result)[i];

			//$($('.pagination')[0]).find('a').attr('href')
			//?page=99
			var pageNum=1;
			
			if(typeof($(row).last().find('a').attr('href')) != "undefined"){
				pageNum=parseInt($(row).last().find('a').attr('href').replace('?page=',''))+1;
			}
			else {
				pageNum=1;				
				break; //if  ?page not found is because there's only one page
			}
			
			var trips = $(row).find('.trip-expand__origin');
			var tripIds = trips.map(function(i, trip) {
			  return $(trip).attr('data-target').slice(6);
			}).toArray();			
			
			var b=3;
			
			if(tripIds.length>0)
			{
				pageNum=tmpNumPages; //once we see some trips, we take the previous page-range.
				break;
			}
			tmpNumPages=pageNum;
		}
		

	   return startParsing(pageNum);

	}, function(err){
		if (err) {
			logStream.write("Error: " + err+"\n");
		  throw err;
		}
	});
	
  };

var startParsing = function(getUpToPage) {
  
 // https://riders.uber.com/trips?pages=&page=21
  
  console.log("\nReading trips up to page num. "+getUpToPage);
  logStream.write("\nReading trips up to page num. "+getUpToPage+"\n");
  
  var pagesToGet = [];  
  
  for (var i = 1; i < getUpToPage + 1; i++) {
    pagesToGet.push(i);
  }

  console.log("\nGetting pages "+ pagesToGet);
  logStream.write("\nGetting pages "+ pagesToGet+"\n");
  
  return async.mapLimit(pagesToGet, CONCURRENCY, requestTripList, function(err, result) {
    if (err) {
		logStream.write("Error: " + err+"\n");
      throw err;
    }
	
    console.log("\nFetched all pages, got " + result.length + " results\n");
    logStream.write("\nFetched all pages, got " + result.length + " results\n");
	
    var combined = result.join(' ');
    var $ = cheerio.load(combined);
    
    var trips = $('.trip-expand__origin');
    var tripIds = trips.map(function(i, trip) {
      return $(trip).attr('data-target').slice(6);
    }).toArray();
    
/*
	//Get trip splits by main page through dictionary trip
	//DAP: Dictionary Splits & Trip requests information [tripID, Trip Info/Splits]
	 var tmpsplits = $('.trip-expand__origin .color--neutral');
	 var splitedTrips={};
	 tmpsplits.map(function(i, trip) {
		var tmpTrip=$(trip).html();
		var tmpID= $(trip).parent().parent().attr('data-target').replace('#trip-','');
		splitedTrips[tmpID]=tmpTrip;
    });
	console.log(splitedTrips);

*/
	
    return async.map(tripIds, downloadTrip, function(err, results) {
      if (err) {
		  logStream.write("Error: " + err+"\n");
        throw err;
      }

      console.log("\nFinished downloading all trips\n");
	  logStream.write("\nFinished downloading all trips\n");
	  
      // parse results and remove those that were errors
      for (var i = results.length; i--;) {
        if (results[i] == "error") {
          results.splice(i, 1);
        }
      }

      var featureCollection = {
        type: "FeatureCollection",
        features: results
      };
	   
 
	 //Format and export uber trips in a .txt file to be read by QV ---------------------------------------------------------
	console.log("Writing trips into file out/uberData.txt...");
	logStream.write("Writing trips into file out/uberData.txt...\n");
	
//	fs.closeSync(fs.openSync('out/uberData.txt', 'w'));//Creates the file if doesn't exist. And truncate it if it already exists.
//	fs.closeSync(fs.openSync('out/uberData.txt', 'w'));

	var stream = fs.createWriteStream(args[2]);	   
	
	stream.on('open', function(fd) {
		
		stream.write( //Header
			"fareCharged\t"+
			"fareTotal\t"+
			"fareSplitFee\t"+
			"fareSplitWith\t"+
			"fareSplitPaid\t"+
			"car\t"+
			"distance\t"+
			"duration\t"+
			"rating\t"+
			"endTime\t"+
			"startTime\t"+
			"endAddress\t"+
			"startAddress\t"+
			"date\t"+
			"driverName\t"+
			"driverImg\t"+
			"latitude\t"+
			"longitude\t"+
			"TripID\t"+
			"fareBase\t"+
			"fareDistance\t"+
			"fareTime\t"+
			"fareSubtotal\t"+
			"fareUberCredit\t"+		
			"fareSurge\t"+	
			"fareNormalFare\t"+		
			"fareMinimumFare\t"+
			"fareRoundingDown\t"+
			"fareSafeRides\t"+
			"tripHasCorrection\n"
		);		
		for (i=0;i<results.length;i++ )
		{	
			for (var j=0;j<results[i].geometry.coordinates.length;j++ ){
				stream.write(results[i].properties.fareCharged+"\t");
				stream.write(results[i].properties.fareTotal+"\t");
				stream.write(results[i].properties.fareSplitFee+"\t");			
				stream.write(results[i].properties.fareSplitWith+"\t");
				stream.write(results[i].properties.fareSplitPaid+"\t");
				stream.write(results[i].properties.car+"\t");
				stream.write(results[i].properties.distance+"\t");
				stream.write(results[i].properties.duration+"\t");
				stream.write(results[i].properties.rating+"\t");
				stream.write(results[i].properties.endTime+"\t");			
				stream.write(results[i].properties.startTime+"\t");
				stream.write(results[i].properties.endAddress+"\t");			
				stream.write(results[i].properties.startAddress+"\t");
				stream.write(results[i].properties.date+"\t");
				stream.write(results[i].properties.driverName+"\t");
				stream.write(results[i].properties.driverImg+"\t");
				stream.write(results[i].geometry.coordinates[j][1]+"\t"); 			
				stream.write(results[i].geometry.coordinates[j][0]+"\t");
				stream.write(results[i].properties.TripID+"\t");
				stream.write(results[i].properties.fareBase+"\t");
				stream.write(results[i].properties.fareDistance+"\t");
				stream.write(results[i].properties.fareTime+"\t");
				stream.write(results[i].properties.fareSubtotal+"\t");
				stream.write(results[i].properties.fareUberCredit+"\t");
				stream.write(results[i].properties.fareSurge+"\t");
				stream.write(results[i].properties.fareNormalFare+"\t");
				stream.write(results[i].properties.fareMinimumFare+"\t");
				stream.write(results[i].properties.fareRoundingDown+"\t");
				stream.write(results[i].properties.fareSafeRides+"\t");
				stream.write(results[i].properties.tripHasCorrection+"\n")
			}
		}
		return stream.end(function () { 
			console.log("\nDone :)\n"); 
			logStream.write("\nDone :)\n");
		});

	});	
	
 //  console.log("Writing geojson into file out/uberData.geojson...\n");
//	return fs.writeFile('out/uberData.geojson', JSON.stringify(featureCollection)); //we keep JSON file
	
    });
  });
 
};

var downloadTrip = function(tripId, cb) {
  var tripUrl = "https://riders.uber.com/trips/" + tripId;
  
  console.log("Downloading trip " + tripId);
  logStream.write("Downloading trip " + tripId+"\n");
  
  return request(tripUrl, function(err, res, body) {
    if (err) {
		logStream.write("Error: " + err+"\n");
      throw err;
    }

    return parseStats(tripId, body, cb);
  });
};

var parseStats = function(tripId, html, cb) {
  var $ = cheerio.load(html);
  var stats = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString"
    }
  };

  var imgSrc = $('.img--full.img--flush').attr('src');
  if (!imgSrc) {
    return cb(null, "error");
  }

  var urlParts = url.parse(imgSrc, true);
  if (!urlParts.query.path) {
    return cb(null, "error");
  }

  var rawJourney = urlParts.query.path.split('|').slice(2);

  stats.geometry.coordinates = _.map(rawJourney, function(pair) {
    var split = pair.split(',');
    split.reverse(); //x,y instead of y,x provided (lat,lon)
    split[0] = parseFloat(split[0]);
    split[1] = parseFloat(split[1]);
    return split;
  });
  
	// Check if there's any correction by uber in the trip.
	var tripHasCorrection= $('div').text().toLowerCase().indexOf("correction")>0;
	stats.properties["tripHasCorrection"]=tripHasCorrection;
  
  //Direct extract
	//stats.properties.fareCharged = $('.fare-breakdown tr:last-child td:last-child').text();
	// stats.properties.fareTotal = $('.fare-breakdown tr.separated--top.weight--semibold td:last-child').text();
  
  
  $('.fare-breakdown tr').each(function(i, ele, tripId) {
    var elements = $(ele).find('td');
    var text1 = $(elements[0]).text();
    var text2 = $(elements[1]).text();
    var text3 = $(elements[2]).text();
	key='';
	
	var noAssign=false;
	
    var key, label, value;
    if (text1 && text2) {
      label = text1.toLowerCase();
      value = text2;
    } else if (text2 && text3) {
      label = text2.toLowerCase();
      value = text3;
    } else if (text1 && text3) {
      label = text1.toLowerCase();
      value = text3;
    }
	
    switch (label.trim()) {
      case 'base fare':
        key = 'fareBase'; // there's a base fare according to uber car type (asof 23/02/16 uberX is 2.5 ). No time/distance/surge involved in this fare (so far).
        break;
      case 'distance':
        key = 'fareDistance'; // fare due to distance
        break;
      case 'time':
        key = 'fareTime'; // fare due to time
        break;
      case 'subtotal':
        key = 'fareSubtotal'; // sum of fares: base+distance+time+remaining to minimum fare+extra surge (>1x)
        break;
      case 'total':
        key = 'fareTotal'; // fareSubtotal+fare fee for Split (option available only when the trip is being shared)
        break;		
      case 'uber credit':
	  case 'promotion':
        key = 'fareUberCredit'; // Credit offered by uber (i.e: if you share your promotion code)
		break;
      case 'fare split':
        key = 'fareSplitFee'; //Additional commision for trip split (asof 23/02/16 is £0.4+(0.2)*#NumSplitters). This fee is added to the total, and then the total fare is divided by total number of splitters 
		break;
      case 'normal fare':
        key = 'fareNormalFare'; //when surge >1x normal fare (so at 1x) is shown
		break;			
    }
	
	if(key=='')
	{	
		if(typeof(label) != "undefined" && (label.indexOf("safe rides")>0))
		{
			key='fareSafeRides';
		}
		else if(typeof(label) != "undefined" && (label.indexOf("rounding down")>-1))
		{
			key='fareRoundingDown';
		}	
		else if(typeof(label) != "undefined" && (label.indexOf('minimum') > -1))
		{ 
			key = 'fareMinimumFare'; // fare charged to hit the minimum fare price (asof 23/02/15 £5)
		}
		else if (typeof(label) != "undefined" && (label.indexOf('charged')>-1)) 
		{
			key = 'fareCharged'; //actual money charged into the 'credit card' (-splits, -UberCredit)
		} 

		else if (typeof(label) != "undefined" && (label.indexOf('surge')>-1)) 
		{
			key = 'fareSurge'; //fare due to surge increase (>1x) 
		} 
				
		else if(typeof(label) != "undefined" && label.indexOf(' ') > -1 && key.length==0 )
		{
			if (label.indexOf('paid by')>-1)
			{
				var arrPayee= label.split(' ');
				var payee= arrPayee[arrPayee.length-1];
				
				if(typeof(stats.properties['fareSplitWith'])=='undefined' )
				{
					stats.properties['fareSplitWith']=payee;  //Riders with whom I'm spliting the trip with
				}
				else
				{
					stats.properties['fareSplitWith']+=","+payee; //list of split-users separated by ,
					
				}
				stats.properties['fareSplitPaid']=value; //value of the split (the value should be pretty much the same, some 0.01 might differ sometimes though, that's ok :)
				
				noAssign=true;
			}
		}	
		else 
		{
			key=label;
		}
	}
	
	if(!noAssign)
	{
		stats.properties[key] = value
	}	
	
    return true;
  });

  var tripAttributes = $('.trip-details__breakdown .soft--top .flexbox__item');
  tripAttributes.each(function(i, ele) {
    var element = $(ele);

    var key;
    var label = element.find('div').text().toLowerCase();
    var value = element.find('h5').text();

    switch (label) {
      case 'car': // car type
        key = 'car';
        value = CAR_MAP[value] || value;
        break;
      case 'miles': // trip distance
	  case 'kilometers':
        key = 'distance'; 
		
		value = value * (label=="kilometers" ? 1.60934 : 1 );
        break;
      case 'trip time': //trip duration
        key = 'duration';
    }
		
    return stats.properties[key] = value; //convert all distance in miles
  });

  var $rating = $('.rating-complete');
  if ($rating) {
    stats.properties.rating = $rating.find('.star--active').length;  // rating assigned to driver (if any)
  }
  stats.properties.endTime = $('.trip-address:last-child p').text(); // end time
  stats.properties.startTime = $('.trip-address:first-child p').text(); //  start time (since the moment where the driver pressed start)
  stats.properties.endAddress = $('.trip-address:last-child h6').text(); // destination address
  stats.properties.startAddress = $('.trip-address:first-child h6').text(); // start address/pick up point 
  stats.properties.date = $('.page-lead div').text(); // date of the trip
  stats.properties.driverName = $('.trip-details__review .grid__item:first-child td:last-child').text().replace('You rode with ', ''); // driver name
  stats.properties.driverImg= $(".driver-avatar").children('img').attr('src'); // driver picture
  stats.properties.TripID= $('.custom-select__select').val().split('/')[3]; // Unique uber trip ID https://riders.uber.com/trips/[TRIP-ID] for trip details
  
  return cb(null, stats);
};
