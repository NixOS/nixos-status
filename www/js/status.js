var init = new Promise(resolve => {
  window.onload = () => {
    var tbody = document.getElementById("channel-status");
    tbody.innerHTML = "<tr><td class='jsfallback' colspan='5'>Loading data from Prometheus...</td></tr>";
    resolve();
  }
});

async function fetchIssues(label) {
  const response = await fetch(`https://api.github.com/repos/NixOS/nixpkgs/issues?labels=${label}`);
  return await response.json();
}

fetchIssues("1.severity%3A%20channel%20blocker")
  .then(data => data.map(issue => {
    var el = document.createElement('div');
    el.classList = "alert alert-warning";
    el.innerHTML = '<span class="issue-age"></span> <a class="issue-link"></a>';
    const since = moment(issue['created_at']).fromNow();
    el.getElementsByClassName('issue-age')[0].innerText = since;
    el.getElementsByClassName('issue-link')[0].href = issue['html_url'];
    el.getElementsByClassName('issue-link')[0].innerText = issue['title'];
    if (issue['labels'].find(label => label['name'] == 'infrastructure')) {
      el.innerHTML += ' <span class="label label-important">Infrastructure</span>'
    }
    return el;
  }))
  .then(elems => {
    var alerts = document.getElementById('alerts');
    elems.forEach(el => alerts.appendChild(el));
  });

function aggregateByChannel(result) {
  return result.reduce((acc, {
    channel,
    value
  }) => ({
    ...acc,
    [channel]: value
  }), {});
}

async function fetchMetrics(queryType, queryArgs = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryArgs)) {
    params.set(key, String(value));
  }

  const response = await fetch(`https://prometheus.nixos.org/api/v1/${queryType}?${params}`);
  const {
    data
  } = await response.json();

  return data.result;
}

async function fetchCommitDate(commit) {
  const response = await fetch(`https://api.github.com/repos/NixOS/nixpkgs/commits/${commit}`);
  const data = await response.json();
  return moment.utc(data.commit.author.date);
}

function fetchAllCommits(revisions) {
  let promises = {};
  for (let i = 0; i < revisions.length; i++) {
    const revision = revisions[i];
    promises[revision] = (fetchCommitDate(revision))
  };
  return promises;
}

const revisionData = fetchMetrics('query', {
  query: 'channel_revision'
})
  .then(records => (
    records.map(({
      metric
    }) => ({
      channel: metric.channel,
      value: {
        revision: metric.revision,
        short_revision: metric.revision.substring(0, 12),
        github_url: `https://github.com/NixOS/nixpkgs/commit/${metric.revision}`,
        status: metric.status,
      },
    }))
  ))
  .then(aggregateByChannel);


const updateTimeData = fetchMetrics('query', {
  query: 'channel_update_time'
})
  .then(records => (
    records.map(({
      metric,
      value
    }) => ({
      channel: metric.channel,
      value: {
        update_time: value[1],
      },
    }))
  ))
  .then(aggregateByChannel);

const jobsetData = fetchMetrics('query_range', {
  query: 'hydra_job_failed',
  start: moment.utc().subtract(30, "days").format(),
  end: moment.utc().format(),
  step: '1h'
})
  .then(records => (
    records.map(({
      metric,
      values
    }) => {
      const project = metric.project;
      const jobset = metric.jobset;
      const job = metric.exported_job;

      return {
        channel: metric.channel,
        value: {
          current: metric.current == 1,
          project,
          jobset,
          job,
          job_history: values.map(state => state[1] == 0),
          oldest_status: values[0][0],
          hydra_url: `https://hydra.nixos.org/job/${project}/${jobset}/${job}#tabs-constituents`,
        },
      };
    })
  ))
  .then(aggregateByChannel);

function split_channel(channel) {
  var parts = channel.split("-");
  return {
    "time": parts[1],
    "collection": parts[0],
    "qualifier": parts[2] || "",
  }
}

function normalize_channel(channel) {
  const parts = split_channel(channel);
  return [parts['time'], parts['collection'], parts['qualifier']].join("-");
}

function cmp_channels(left, right) {
  const norm_left = normalize_channel(left);
  const norm_right = normalize_channel(right);
  if (norm_left < norm_right) {
    return 1;
  } else if (norm_left > norm_right) {
    return -1;
  } else {
    return 0;
  }
}

init
  .then(() => Promise.all([revisionData, jobsetData]))
  .then(async ([revisions, jobsets]) => {
    const all_commits = Object.values(revisions).map((v) => v.revision);

    const commit_dates_promises = fetchAllCommits(all_commits);
    const commit_dates_entries = await Promise.all(
      Object.entries(commit_dates_promises).map(async ([key, promise]) => [key, await promise])
    );
    const commit_dates = Object.fromEntries(commit_dates_entries);

    return [revisions, commit_dates, jobsets];
  })
  .then(([revisions, commit_dates, jobsets]) => {
    var combined = [];

    for (let [channel, jobset] of Object.entries(jobsets)) {
      jobset['oldest_status_relative'] = moment.unix(jobset['oldest_status']).fromNow()
      // Ensure each jobset here is in each other dataset, guaranteeing we have
      // complete data.
      jobset['channel'] = channel;
      if (revisions[channel] != undefined) {
        jobset['revision'] = revisions[channel]['revision'];
        jobset['short_revision'] = revisions[channel]['short_revision'];
        jobset['github_url'] = revisions[channel]['github_url'];
        jobset['status'] = revisions[channel]['status'];
      } else {
        continue
      }

      const commit_date = commit_dates[revisions[channel]['revision']];
      if (commit_date != undefined) {
        jobset['update_time_relative'] = commit_date.fromNow()
        jobset['update_time_local'] = commit_date.format()
        // do not use color indications on outdated channels
        if (jobset['current']) {
          if (commit_date > moment().subtract(3, 'days')) {
            jobset['update_age'] = "success";
          } else if (commit_date > moment().subtract(10, 'days')) {
            jobset['update_age'] = "warning";
          } else {
            jobset['update_age'] = "important";
          }
        }
      } else {
        continue
      }

      combined.push(jobset);
    }

    combined.sort((left, right) => cmp_channels(left['channel'], right['channel']));

    return combined;
  })
  .then(data => {
    return data.map(record => {
      var row = document.createElement('tr');
      row.innerHTML = '<td class="channel" /><td><span class="age label"></span></td><td class="github"><a class="revision" /></td><td class="hydra"><a class="hydra-link" /></td><td class="status"></td>';
      var status = row.getElementsByClassName("status")[0];

      if (record['current']) {
        row.classList.add("current")
      }
      row.getElementsByClassName("channel")[0].innerText = record['channel'];

      var date = row.getElementsByClassName("age")[0];
      date.innerText = record['update_time_relative'];
      date.title = record['update_time_local'];
      date.classList.add("label-" + record['update_age']);

      var revisions = row.getElementsByClassName("revision")[0];
      revisions.innerText = record['short_revision'];
      revisions.href = record['github_url'];

      var hydraLink = row.getElementsByClassName("hydra-link")[0];
      hydraLink.href = record['hydra_url'];
      hydraLink.innerText = [record['project'], record['jobset'], record['job']].join('/');

      const statusToColor = status => status ? "#b5ffb5" : "#ff9e9e";

      var hydra = row.getElementsByClassName("hydra")[0];
      switch (record['job_history'].length) {
        case 0:
          // Unknown, no color, leave it gray.
          break;
        case 1:
          hydra.style.backgroundColor = statusToColor(record['job_history'][0]);
          break;
        default:
          hydra.style.backgroundImage = "linear-gradient(to right, " +
            (record['job_history'].map(statusToColor)).join(", ") +
            ")";
          break;
      }

      hydra.title = `The Hydra job's state over time, since ${record['oldest_status_relative']}`;

      switch (record['status']) {
        case "beta":
          status.innerHTML += '<span class="label label-info">Beta</span>';
          break;
        case "deprecated":
          status.innerHTML += '<span class="label label-warning">Deprecated</span>';
          break;
        case "unmaintained":
          row.classList.add("stale")
          status.innerHTML += '<span class="label label-important">End of life</span>';
          break;
        case "stable":
          status.innerHTML += '<span class="label label-success">Stable</span>';
          break;
        case "rolling":
          status.innerHTML += '<span class="label label-success">Rolling</span>';
          break;
      }
      if (record['job_history'][record['job_history'].length - 1] == 0 && record['status'] != "unmaintained") {
        status.innerHTML += '<span class="label label-important">Build problem</span>';
      }
      return row;
    })
  })
  .then(rows => {
    var tbody = document.getElementById("channel-status");
    tbody.innerHTML = "";
    rows.forEach(row => {
      tbody.appendChild(row);
    });
  });
