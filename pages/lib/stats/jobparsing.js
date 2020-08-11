var $ = require('jquery');
var clusterCodes = require('../../../lib/clusters.js');

global.jQuery = $;

function prepareData(jobs, unit, start, end, cb) {

  // convert timestamps to Date()s


  var eventIdAndDescription = [];

  function processJob(d) {
    return new Promise(resolve => {
      var thisJobisAck = false;
      var thisJobisComp = false;

      if (d.Event) {
        var words = d.Event.Identifier + " - " + d.Event.Name;
        eventIdAndDescription[words] = (eventIdAndDescription[words] || 0) + 1;
      }

      if (d.LGA == null) {
        d.LGA = "N/A";
      }

      if (d.SituationOnScene == null) {
        d.SituationOnScene = "N/A";
      }

      if (d.Address.Locality == null) {
        d.Address.Locality = "N/A";
      }


      d.JobReceivedFixed = new Date(d.JobReceived)


      d.hazardTags = [];
      d.treeTags = [];
      d.propertyTags = [];
      d.jobtype = "";
      var jobtype = [];
      var JobTypeDict = {
        'Tree': ['Tree Down', 'Branch Down', 'Tree Threatening', 'Branch Threatening'],
        'Damage': ['Roof Damage', 'Ceiling Damage', 'Door Damage', 'Wall Damage', 'Window Damage', 'Threat of Collapse'],
        'Leak': ['Leaking Roof']
      }

      for (var key in JobTypeDict) { //for each key
        var value = JobTypeDict[key]

        $.each(value, function(d3) { //for each value
          if (FindTag(value[d3])) {
            jobtype.push(key)
          }
        })
      }

      jobtype = Array.from(new Set(jobtype)); // #=> ["foo", "bar"]


      jobtype.sort();

      d.jobtype = jobtype.join("+")


      if (d.jobtype == "") {
        d.jobtype = "N/A"
      }

      function FindTag(name) {
        var found = false;
        d.Tags.forEach(function(d2) {
          if (d2.Name == name) {
            found = true;
          }
        })

        if (found == false) {
          return false
        } else {
          return true
        }

      }

      d.Tags.forEach(function(d2) {
        switch (d2.TagGroupId) {
          case 5:
            d.treeTags.push(d2.Name);
            break;
          case 7:
          case 8:
          case 9:
            d.hazardTags.push(d2.Name);
            break
          case 10:
          case 11:
          case 13:
            d.propertyTags.push(d2.Name);
            break;
        }
      });


      if (d.ReferringAgency == null) {
        d.ReferringAgencyID = "N/A"
      } else {
        d.ReferringAgencyID = d.ReferringAgency
      }

      if (d.Event == null) {
        d.EventID = "N/A"
      } else {
        d.EventID = d.Event.Identifier
      }

      d.JobOpenFor = 0;
      d.JobCompleted = new Date(0); //do it with a 1970 so that its a valid date. will filter out later
      var jobstart = 0;
      var jobend = 0;
      for (var counter = 0; counter < (d.JobStatusTypeHistory.length); counter++) {
        switch (d.JobStatusTypeHistory[counter].Type) {
          case 1: // New
            break;
          case 2: // active
            jobstart = (jobstart == 0 ? new Date(d.JobStatusTypeHistory[counter].Timelogged) : jobstart) //only count first
            break;
          case 3:
            break;
          case 4: //tasked
            break;
          case 6: //complete
            jobend = (jobend == 0 ? new Date(d.JobStatusTypeHistory[counter].Timelogged) : jobend) //only count first
            if (thisJobisComp == false) {
              thisJobisComp = true;
              d.JobCompleted = new Date(d.JobStatusTypeHistory[counter].Timelogged)
            }
            break;
          case 7:
            if (thisJobisComp == false) {
              thisJobisComp = true;
              d.JobCompleted = new Date(d.JobStatusTypeHistory[counter].Timelogged)
            }
            break;
          case 8:
            if (thisJobisComp == false) {
              thisJobisComp = true;
              d.JobCompleted = new Date(d.JobStatusTypeHistory[counter].Timelogged)
            }
            break;
        }
      }
      if (jobstart != 0 && jobend != 0) {
        d.JobDuration = jobend - jobstart
        if (d.JobDuration < 0) {
          d.JobDuration = 0
        }
      } else {
        d.JobDuration = 0
      }

      clusterCodes.returnCluster(d.EntityAssignedTo.Name, function(cluster) { //sync call to get cluster name
        if (typeof cluster !== 'undefined') {
          d.EntityAssignedTo.Cluster = cluster.clusterName
        } else {
          d.EntityAssignedTo.Cluster = "Unknown"
        }
        resolve(true) //resolve the promise, everthing else in here isnt async so we can call this here
      })
    })
  }

  async function processArray(array, cb) {
    for (var d of array) {
      await processJob(d);
    }
    console.log('Job processArray Completed')
    cb();
  }

  processArray(jobs.Results, function() {

    var options = {
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "numeric",
      hour12: false
    };

    if (unit.length == 0) { //whole nsw state
      document.title = "NSW Job Statistics";
      $('.stats header h2').text('Job statistics for NSW');
    } else { //multiple units
      if (Array.isArray(unit) == false) { //single unit
        document.title = unit.Name + " Job Statistics";
        $('.stats header h2').text('Job statistics for ' + unit.Name);
      }
      if (unit.length > 1) { //more than one

        var unitParents = []
        unit.forEach(function(d2) {
          unitParents[d2.ParentEntity.Code] = (unitParents[d2.ParentEntity.Code] || 0) + 1;
        })
        if (Object.keys(unitParents).length == 1) //if theres only 1 LHQ
        {
          $('.stats header h2').text('Job statistics for (' + unitParents[Object.keys(unitParents)[0]] + ') ' + Object.keys(unitParents)[0] + ' units');
        } else {
          $('.stats header h2').text('Job statistics for Group');

        }

        document.title = "Group Job Statistics";
      }
    }

    $('.stats header h4').text(
      start.toLocaleTimeString("en-au", options) + " to " +
      end.toLocaleTimeString("en-au", options)
    );

    var banner = "";

    for (var i = 0; i < Object.keys(eventIdAndDescription).length; ++i) {
      banner = i == 0 ? banner + Object.keys(eventIdAndDescription)[i] : banner + " | " + Object.keys(eventIdAndDescription)[i];
    }
    var speed = 15
    if (banner.length > 1000) {
      speed = 70
    } else if (banner.length > 500 && banner.length < 1000) {
      speed = 30
    }

    $('#events').text(banner);

    $('#events').css('animation', 'marquee ' + speed + 's linear infinite')

    cb(jobs) //return clean jobs
  })

}


module.exports = {
  prepareData: prepareData,
}
