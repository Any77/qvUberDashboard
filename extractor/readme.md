# #uberdata trip script v2

Note: This code is provided for reference purposes only.  

Code based on https://github.com/chriswhong/uber-trip-script (which was based on https://github.com/joshhunt/uber](https://github.com/joshhunt/uber)

Differences from the source linked above:
- No config.json needed (credentials passed as a parameters)
- Dichothmic search to roughly identify how many pages we have to read (withouth having to specify them)
- More fares are being collected
- Driver image link included
- Trip split info included
- Uber pool included
- Tested in UK, FR & USA
- Export & Normalize data to .txt
- Normalized distance to miles
- More commentrary added into the code 
- Identify trip corrections by Uber



## Install
```sh
# Clone the source code
$ git clone https://github.com/anguila/qvUberDashboard.git && cd extractor

# Install NPM dependencies
$ npm install
```


## Usage
```sh
$ node app.js your@email.com Password out/UberData.txt
Requesting login page...

Logging in as your@email.com...

Cool, logged in :)

Finding out how many pages we've to read...

Fetching https://riders.uber.com/trips?page=100
Fetching https://riders.uber.com/trips?page=50
Fetching https://riders.uber.com/trips?page=25
Fetching https://riders.uber.com/trips?page=12
Fetching https://riders.uber.com/trips?page=6
Fetching https://riders.uber.com/trips?page=3
Fetching https://riders.uber.com/trips?page=1

Reading trips up to page num. 12

Getting pages 1,2,3,4,5,6,7,8,9,10,11,12
Fetching https://riders.uber.com/trips?page=1
Fetching https://riders.uber.com/trips?page=2
Fetching https://riders.uber.com/trips?page=3
Fetching https://riders.uber.com/trips?page=4
....
Downloading trip **********************************12
Downloading trip **********************************c4
Downloading trip **********************************46
Downloading trip **********************************76
Downloading trip **********************************ed
....

Finished downloading all trips

Writing trips into file out/uberData.txt...

Done :)

```

