var timeoverride = null;

// window.onerror = function(message, url, lineNumber) {  
//   document.getElementById("loading").innerHTML = "Error loading page<br>"+message;
//   return true;
// }; 



//on DOM load
document.addEventListener('DOMContentLoaded', function() {

    //run every X period of time the main loop.
    display = document.querySelector('#time');
    startTimer(180, display);

    RunForestRun()

});


$(document).on('change', 'input[name=slide]:radio', function() {
    console.log(this.value);
    timeoverride = this.value;


    RunForestRun();
});

//refresh button
$(document).ready(function() {
    document.getElementById("refresh").onclick = function() {
        RunForestRun();
    }
});


function myScript() {
    console.log("radio");
}

function getSearchParameters() {
    var prmstr = window.location.search.substr(1);
    return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray(prmstr) {
    var params = {};
    var prmarr = prmstr.split("&");
    for (var i = 0; i < prmarr.length; i++) {
        var tmparr = prmarr[i].split("=");
        params[tmparr[0]] = tmparr[1];
    }
    return params;
}

var timeperiod;
var unitname = "";


var params = getSearchParameters();

//update every X seconds
function startTimer(duration, display) {
    var timer = duration,
        minutes, seconds;
    setInterval(function() {
        minutes = parseInt(timer / 60, 10)
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = minutes + ":" + seconds;

        if (--timer < 0) { //when the timer is 0 run the code
            timer = duration;
            RunForestRun();
        }
    }, 1000);
}



//Get times vars for the call
function RunForestRun() {

    if (timeoverride !== null) { //we are using a time override

        var end = new Date();

        var start = new Date();
        start.setDate(start.getDate() - (timeoverride / 24));


        starttime = start.toISOString();
        endtime = end.toISOString();

        console.log(starttime);
        console.log(endtime);

        params.start = starttime;
        params.end = endtime;

    }


    //IF TRAIN BEACON

    if (params.host == "trainbeacon.ses.nsw.gov.au")
    {
        document.body.style.backgroundColor = "green";
    }


    if (unitname == "") {

        console.log("firstrun...will fetch vars");



        if (typeof params.hq !== 'undefined') {

            if (params.hq.split(",").length == 1) {

                GetUnitNamefromBeacon(params.hq,params.host, function(returnedunitname) {
                    unitname = returnedunitname;
                    HackTheMatrix(params.hq, returnedunitname,params.host);
                });

            } else {
                console.log("passed array of units");
                unitname = "group selection";
                HackTheMatrix(params.hq, unitname,params.host);
            }

        } else { //no hq was sent, get them all
            unitname = "NSW";
            HackTheMatrix(null, unitname,params.host);
        }




    } else {
        console.log("rerun...will NOT fetch vars");
        if (typeof params.hq == 'undefined') {
            HackTheMatrix(null, unitname);
        } else {
            HackTheMatrix(params.hq, unitname,params.host);
        }

    }




}

//make the call to beacon
function HackTheMatrix(id, unit,host) {


    document.title = unitname + " Team Summary";


    var start = new Date(decodeURIComponent(params.start));
    var end = new Date(decodeURIComponent(params.end));
    var totalMembersActive = 0;

    GetJSONfromBeacon(id, host, start, end, function(teams) {

        console.log(teams);
        var options = {
            weekday: "short",
            year: "numeric",
            month: "2-digit",
            day: "numeric"
        };



        var table = document.getElementById("resultstable").getElementsByTagName('tbody')[0];

        var tableRows = table.getElementsByTagName('tr');
        var rowCount = tableRows.length;

        for (var x = rowCount - 1; x > 0; x--) {
            table.removeChild(tableRows[x]);
        }

        teams.Results.forEach(function(d) { //for every team


            if (d.TeamStatusType.Name !== "Stood Down") //that has not stood down
            {



                var row = table.insertRow(-1);
                var callsign = row.insertCell(0);
                var members = row.insertCell(1);
                var status = row.insertCell(2);
                var jobCount = row.insertCell(3);
                var latestupdate = row.insertCell(4);
                latestupdate.className = "update";

                callsign.innerHTML = d.Callsign;
                callsign.className = "callsign";


                if (d.Members.length == 0) {
                    members.innerHTML = "Empty"
                } else {
                    d.Members.forEach(function(d2) { //for each member in the team
                        totalMembersActive++; //count them
                        if (members.innerHTML == "") { //if the first in the string dont add command
                            if (d2.TeamLeader == true) { //bold if team leader
                                members.innerHTML = "<b>" + d2.Person.FirstName + " " + d2.Person.LastName + "</b>";
                            } else { //not bold
                                members.innerHTML = d2.Person.FirstName + " " + d2.Person.LastName;
                            }
                        } else { //not first in string
                            if (d2.TeamLeader == true) { //bold if team leader
                                members.innerHTML = members.innerHTML + ", " + "<b>" + d2.Person.FirstName + " " + d2.Person.LastName + "</b>";
                            } else { // not team leader
                                members.innerHTML = members.innerHTML + ", " + d2.Person.FirstName + " " + d2.Person.LastName;
                            }
                        }
                    })
                }
                members.className = "members";

                var rawteamdate = new Date(d.TeamStatusStartDate);
                var teamdate = new Date(rawteamdate.getTime() + (rawteamdate.getTimezoneOffset() * 60000));
                status.innerHTML = d.TeamStatusType.Name +"<br>"+teamdate.toLocaleTimeString("en-au", options);
                status.className = "status";



                var latest = null;
                var oldesttime = null;
                var completed = 0;
                GetTaskingfromBeacon(d.Id,host, function(e) {
                    e.Results.forEach(function(f) {
                        f.CurrentStatus == "Complete" && completed++;
                        var rawdate = new Date(f.CurrentStatusTime);
                        var thistime = new Date(rawdate.getTime() + (rawdate.getTimezoneOffset() * 60000));
                        if (oldesttime < thistime && f.CurrentStatus !== "Tasked" && f.CurrentStatus !== "Untasked") {
                            latest = f.CurrentStatus + " #" + f.Job.Identifier + "<br>" + f.Job.Address.PrettyAddress + "<br>" + thistime.toLocaleTimeString("en-au", options);
                            oldesttime = thistime;
                        }
                    });

                    if (latest == null) {
                        latest = "No Updates";
                    }
                    latestupdate.innerHTML = latest;

                jobCount.innerHTML = d.TaskedJobCount+"/"+completed;
                jobCount.className = "jobcount";
                });

                latestupdate.innerHTML = "<img width=\"20%\" alt=\"Loading...\" src=\"resources/images/loader.gif\">";


            }
        });
        document.getElementById("banner").innerHTML = "<h2>Team summary for " + unit + "</h2><h4>" + start.toLocaleTimeString("en-au", options) + " to " + end.toLocaleTimeString("en-au", options) + "<br>Total Active Members: " + totalMembersActive + "</h4>";
        document.getElementById("loading").style.visibility = 'hidden';


    });
}