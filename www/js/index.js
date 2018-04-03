var map;
var tiles;

var selector = "P1";

var ArraySensorMobile=[];

var PMDateGPS ={"date":"","gps":[],"P1":0,"P2":0};
var emptyGeojson = {"type":"FeatureCollection","features":[]};

var recording;
var stationary;
var mobile;
var mobileloadall;
var mobileloadown;

var dataGraph = [];

var url = "http://api.luftdaten.info/static/v2/data.dust.min.json";

var buffer = [];
var value = 0;
var pm25_serial = 0;
var pm10_serial = 0;
var checksum_is = 0;
var serial_pos = 0;
var checksum_ok = 0;


var fileObject;


var svg = d3.select("body").append("svg")
            .style("visibility","hidden")
        .attr("id","linechart")
            .attr("onclick","removeSvg()");

var allloaded = false; 



document.addEventListener('deviceready', onDeviceReady, false);

map = L.map('map',{ zoomControl:false, minZoom:1 }).setView([50.495171, 9.730827], 6);

tiles = L.tileLayer('https://{s}.tiles.madavi.de/{z}/{x}/{y}.png',{
              attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
              maxZoom: 18}).addTo(map);

function onDeviceReady() {
    
        console.log(cordova.file);

    
            window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, fail);
    

      if (!navigator.geolocation){alert("Geolocation is not supported by your browser")};

      navigator.geolocation.getCurrentPosition(function(position) {

      	var latitude  = position.coords.latitude;
      	var longitude = position.coords.longitude;

        map.setView([latitude, longitude], 16);

        L.marker([latitude, longitude]).addTo(map);
          
      		}, function(error) {
      		alert('code: '    + error.code    + '\n' +
      					'message: ' + error.message + '\n');
      });
    
    


      var errorCallback = function(message) {
              alert('Error: ' + message);
            };


            serial.requestPermission(
              function(successMessage) {
                        serial.open(
                            {baudRate: 9600},
                            function(successMessage) {

                      serial.registerReadCallback(
                        function success(data){
                          var view = new Uint8Array(data);
                          setTimeout(function(){
                            if(view.length >= 1) {
                              for(var i=0; i < view.length; i++) {
                                buffer.push(view[i]);
                              };
                            };
                            while (buffer.length > 0) {
                              value = buffer.shift();
                              switch (serial_pos) {
                                case 0: if (value != 170) { serial_pos = -1; }; break;
                                case 1: if (value != 192) { serial_pos = -1; }; break;
                                case 2: pm25_serial = value; checksum_is = value; break;
                                case 3: pm25_serial += (value << 8); checksum_is += value; break;
                                case 4: pm10_serial = value; checksum_is += value; break;
                                case 5: pm10_serial += (value << 8); checksum_is += value; break;
                                case 6: checksum_is += value; break;
                                case 7: checksum_is += value; break;
                                case 8:
                                  if (value == (checksum_is % 256)) { checksum_ok = 1; } else { serial_pos = -1; }; break;
                                case 9: if (value != 171) { serial_pos = -1; }; break;
                              };
                              serial_pos++;
                              if (serial_pos == 10 && checksum_ok == 1) {
                                if ((! isNaN(pm10_serial)) && (! isNaN(pm25_serial))) {


                                  var d = new Date();
                                  var isodate = d.toISOString();
                                  PMDateGPS.date = isodate;


                                  navigator.geolocation.getCurrentPosition(function(position) {
                                                var gps = [position.coords.latitude,position.coords.longitude];
                                                PMDateGPS.gps = gps;
                                          }, function(error) {
                                          alert('code: '    + error.code    + '\n' +
                                                'message: ' + error.message + '\n');
                                      });

                                      PMDateGPS.P1 = parseInt((pm10_serial/10));
                                      PMDateGPS.P2 = parseInt((pm25_serial/10));

                                  

                            };
                                serial_pos = 0;
                                checksum_ok = 0;
                                pm10_serial = 0;
                                pm25_serial = 0;
                                checksum_is = 0;
                              }
                            }
                          },200);
                        },
                        errorCallback
                      );
                  },
                  errorCallback
                );
              },
              errorCallback
            );
    
    
  
    
    stationary = L.geoJSON(emptyGeojson,{
			     pointToLayer: function (feature, latlng) {
                        return L.circleMarker(latlng, {
                      radius:10,
                      fillColor: color(feature.properties,selector),
                      color: '#FFFFFF',
                      weight: 3,
                      opacity: 1.0,
                      fillOpacity: 1.0})
                 },onEachFeature: function (feature, layer) {
                      var popupContent = "<table id='results'><tr><th class ='titre'>Sensor ID</th><th class = 'titre'>PM10 &micro;g/m&sup3;</th><th class ='titre'>PM2.5 &micro;g/m&sup3;</th></tr><tr><td id='idsens'>"+layer.feature.properties.id+"</td><td id='P1sens'</td>"+layer.feature.properties.P1+"<td id='P2sens'>"+layer.feature.properties.P2+"</td></tr></table>";
                      layer.bindPopup(popupContent,{closeButton:true, minWidth:300});
                    }}).addTo(map);
    
    
    mobileloadall =L.geoJSON(emptyGeojson, {
        pointToLayer: function (feature, latlng) {
				return L.circleMarker(latlng, {
    radius:10,
    fillColor: color(feature.properties,selector),
    color: '#000000',
    weight: 3,
    opacity: 1.0,
    fillOpacity: 1.0});        
        },onEachFeature:function (feature, layer) {			
            var popupContent = "<table id='results'><tr><th class ='titre'>Date</th><th class = 'titre'>PM10 &micro;g/m&sup3;</th><th class ='titre'>PM2.5 &micro;g/m&sup3;</th></tr><tr><td id='date'>"+layer.feature.properties.date+"</td><td id='P1sens'</td>"+layer.feature.properties.P1+"<td id='P2sens'>"+layer.feature.properties.P2+"</td></tr></table><button id='graph' onclick='displayGraph()' >Graphic</button>";
           	layer.bindPopup(popupContent);
        }
        }).addTo(map);
    
    
      
    d3.json("https://api.luftdaten.info/static/v2/data.dust.min.json", function(error, data) {
        if (error) throw error;
        

          data.forEach(function(item){
            var emptyFeature = {"type":"Feature","geometry":{"type":"Point","coordinates":[]},"properties":{"id":0,"P1":"","P2":""}};
            emptyFeature.geometry.coordinates[0] = item.location.longitude;
            emptyFeature.geometry.coordinates[1] = item.location.latitude;
            emptyFeature.properties.id = item.sensor.id;
            emptyFeature.properties.P1 = getRightValue(item.sensordatavalues,"P1");
            emptyFeature.properties.P2 = getRightValue(item.sensordatavalues,"P2");
            stationary.addData(emptyFeature);
          });        
        
      });
    
    
          d3.interval(function(){

   		 stationary.clearLayers();
        
        d3.json("https://api.luftdaten.info/static/v2/data.dust.min.json", function(error, data) {
        if (error) throw error;
        
          data.forEach(function(item){
            var emptyFeature = {"type":"Feature","geometry":{"type":"Point","coordinates":[]},"properties":{"id":0,"P1":"","P2":""}};
            emptyFeature.geometry.coordinates[0] = item.location.longitude;
            emptyFeature.geometry.coordinates[1] = item.location.latitude;
            emptyFeature.properties.id = item.sensor.id;
            emptyFeature.properties.P1 = getRightValue(item.sensordatavalues,"P1");
            emptyFeature.properties.P2 = getRightValue(item.sensordatavalues,"P2");
            stationary.addData(emptyFeature);
            });        
      });
   

   			console.log('reload');

   	    }, 300000);
        
};

function getRightValue(array,type){
		    var value;
		    array.forEach(function(item){
		       if (item.value_type == type){value = item.value;};
		    });
		    return value;
		};

function switcher(){

	if (document.getElementById('switch').checked){

    alert('Recording');

    ArraySensorMobile.push(PMDateGPS);

    var popupContent = "<table id='results'><tr><th class ='titre'>Date</th><th class = 'titre'>PM10 &micro;g/m&sup3;</th><th class ='titre'>PM2.5 &micro;g/m&sup3;</th></tr><tr><td id='date'>"+PMDateGPS.date+"</td><td id='P1sens'</td>"+PMDateGPS.P1+"<td id='P2sens'>"+PMDateGPS.P2+"</td></tr></table>";

    L.circleMarker(PMDateGPS.gps, {
    radius:10,
    fillColor: color(PMDateGPS,selector),
    color: '#000000',
    weight: 3,
    opacity: 1.0,
    fillOpacity: 1.0}).bindPopup(popupContent).addTo(map);

     recording = setInterval(function(){

      ArraySensorMobile.push(PMDateGPS);

      var popupContent = "<table id='results'><tr><th class ='titre'>Date</th><th class = 'titre'>PM10 &micro;g/m&sup3;</th><th class ='titre'>PM2.5 &micro;g/m&sup3;</th></tr><tr><td id='date'>"+PMDateGPS.date+"</td><td id='P1sens'</td>"+PMDateGPS.P1+"<td id='P2sens'>"+PMDateGPS.P2+"</td></tr></table>";

      L.circleMarker(PMDateGPS.gps, {
      radius:10,
      fillColor: color(PMDateGPS,selector),
      color: '#000000',
      weight: 3,
      opacity: 1.0,
      fillOpacity: 1.0}).bindPopup(popupContent).addTo(map);

    }, 5000);

   } else {
     alert('Recording stopped');
     clearInterval(recording);
	};
};


function color(arr,sel){    
    
    if (sel=="P1"){
        var col = parseInt(arr.P1);
        var val = arr.P1;
    };
    
    if (sel=="P2"){
        var col = parseInt(arr.P2);
        var val = arr.P2;
    };
    
    if(val>= 0 && val < 25){ return "#00796b";};
    if(val>= 25 && val < 50){
        var couleur = interpolColor('#00796b','#f9a825',(col-25)/25);
        return couleur;
    };
    if(val>= 50 && val < 75){
        var couleur = interpolColor('#f9a825','#e65100',(col-50)/25);
        return couleur;
    };
    if(val>= 75 && val < 100){
        var couleur = interpolColor('#e65100','#dd2c00',(col-75)/25);
        return couleur;
    };
    if(val>=100 && val < 500){
        var couleur = interpolColor('#dd2c00','#8c0084',(col-100)/400);
        return couleur;
    };

    if(val>=500){ return "#8c0084";};
};


function interpolColor(a, b, amount) {
    var ah = parseInt(a.replace(/#/g, ''), 16),
        ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
        bh = parseInt(b.replace(/#/g, ''), 16),
        br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
        rr = ar + amount * (br - ar),
        rg = ag + amount * (bg - ag),
        rb = ab + amount * (bb - ab);
    return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb | 0).toString(16).slice(1);
};

function gotFS(fileSystem) {
    fileSystem.root.getFile("readme.txt", {create: true, exclusive: false}, gotFileEntry, fail);
};

function gotFileEntry(fileEntry) {
    fileEntry.createWriter(gotFileWriter, fail);
};

function gotFileWriter(writer) {
    writer.onwriteend = function(evt) {
        console.log("contents of file now 'some sample text'");
        writer.truncate(11);  
        writer.onwriteend = function(evt) {
            console.log("contents of file now 'some sample'");
            writer.seek(4);
            writer.write(" different text");
            writer.onwriteend = function(evt){
                console.log("contents of file now 'some different text'");
            }
        };
    };
    writer.write(new Blob(["some sample text"], {type: 'text/plain'}));
};



function fail(error) {
    console.log(error.code);
};

function selectPM(val){
    
    selector = val;
    console.log(val);
    stationary.clearLayers();  
    
     d3.json("https://api.luftdaten.info/static/v2/data.dust.min.json", function(error, data) {
        if (error) throw error;
        

          data.forEach(function(item){
            var emptyFeature = {"type":"Feature","geometry":{"type":"Point","coordinates":[]},"properties":{"id":0,"P1":"","P2":""}};
            emptyFeature.geometry.coordinates[0] = item.location.longitude;
            emptyFeature.geometry.coordinates[1] = item.location.latitude;
            emptyFeature.properties.id = item.sensor.id;
            emptyFeature.properties.P1 = getRightValue(item.sensordatavalues,"P1");
            emptyFeature.properties.P2 = getRightValue(item.sensordatavalues,"P2");
            stationary.addData(emptyFeature);
              
  
              
            });        
      });
    
    if (allloaded == true){
    
        mobileloadall.clearLayers();  

        d3.csv("https://crossorigin.me/http://pjgueno.000webhostapp.com/hlrs/csvexemple3.csv", function(error, data) {
        if (error) throw error;
                                
          data.forEach(function(item){
              
            var emptyFeature = {"type":"Feature","geometry":{"type":"Point","coordinates":[]},"properties":{"date":0,"P1":"","P2":""}};
              
            emptyFeature.geometry.coordinates[0] = parseFloat(item.lon);
            emptyFeature.geometry.coordinates[1] = parseFloat(item.lat);
            emptyFeature.properties.date = item.date;
            emptyFeature.properties.P1 = item.P1;
            emptyFeature.properties.P2 = item.P2;
            mobileloadall.addData(emptyFeature);
            });        
      });
        
        
        
        
    };
    
    
};

function dataloader(sel){
    
    if (sel == "loadall"){
        
        
        allloaded = true; 
        
            d3.csv("https://crossorigin.me/http://pjgueno.000webhostapp.com/hlrs/csvexemple3.csv", function(error, data) {
        if (error) throw error;
                                
                dataGraph = [];
                
          data.forEach(function(item){
                            
            dataGraph.push(item);
              
            var emptyFeature = {"type":"Feature","geometry":{"type":"Point","coordinates":[]},"properties":{"date":0,"P1":"","P2":""}};
              
            emptyFeature.geometry.coordinates[0] = parseFloat(item.lon);
            emptyFeature.geometry.coordinates[1] = parseFloat(item.lat);
            emptyFeature.properties.date = item.date;
            emptyFeature.properties.P1 = item.P1;
            emptyFeature.properties.P2 = item.P2;
            mobileloadall.addData(emptyFeature);
            }); 
                
                           map.fitBounds(mobileloadall.getBounds());
 
                
      });
        
            
    }; 
    
    
    
};


//SEULEMENT POUR EXEMPLE. RELEVANT QUE POUR LES OWN VALUES

function displayGraph() {
    
    var parseTime = d3.isoParse;  
    
    console.log(dataGraph.length);
        
    dataGraph.sort(function(a, b){return parseTime(a.date)-parseTime(b.date)});
    
    
    var linechart  = document.getElementById("linechart"); 
    var rect = linechart.getBoundingClientRect(); 
    
    var widthGraph = parseInt(rect.width);
    var heightGraph = parseInt(rect.height);
    
    console.log(widthGraph);
    console.log(heightGraph);
    
    var margin = {top: 20, right: 80, bottom: 30, left: 70},
    width = widthGraph - margin.left - margin.right,
    height = heightGraph - margin.top - margin.bottom;
    
    var x = d3.scaleTime().range([0, width]);
    var y = d3.scaleLinear().range([height, 0]);
    
    dataGraph.forEach(function(d) {
      d.date = parseTime(d.date);
        d.P1 = +d.P1;
        d.P2 = +d.P2;
  });
    
    var valueline1 = d3.line()
    .curve(d3.curveBasis)
    .x(function(d) {return x(d.date)})
    .y(function(d) {return y(d.P1)});
    
     var valueline2 = d3.line()
    .curve(d3.curveBasis)
    .x(function(d) {return x(d.date)})
    .y(function(d) {return y(d.P2)});
    
    x.domain(d3.extent(dataGraph, (d) => d.date));
    y.domain([0,d3.max(dataGraph, (i) => i.P1)]);
    
    console.log(d3.extent(dataGraph, (d) => d.date));
    console.log([0,d3.max(dataGraph, (i) => i.P1)]);
    
     svg.append("path")
      .data([dataGraph])
      .attr("class", "line1")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      .attr("d", valueline1);
    
     svg.append("path")
      .data([dataGraph])
      .attr("class", "line2")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      .attr("d", valueline2);
    
     svg.append("g")  
    .attr("transform", "translate(" + margin.left + "," + (heightGraph - 30) + ")")
    .attr("class", "axis axis--x")
    .call(d3.axisBottom(x));

  svg.append("g")
  .attr("class", "axis axis--y")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      .call(d3.axisLeft(y))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em")
      .attr("fill", "#000")
      .text(function(){return "PM μg/m³"}); 
    
    
    svg.style("visibility", "visible");
    
    
    
};


function removeSvg(){
//        svg.selectAll("*").remove();
    svgtest = false;
    svg.style("visibility", "hidden");
};