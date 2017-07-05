const bodyParser = require('body-parser');
const express = require('express');
const gitHubWebHook = require('express-github-webhook');
const rp = require('request-promise');

const headers = {
    'User-Agent': 'forum-reminder',
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
};

const webHookHandler = gitHubWebHook({
    path: '/',
    secret: process.env.SECRET || '',
});

// Setup
const app = express();
app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json());
app.use(webHookHandler);

function findLinksWithRegex(comments, regularExpression) {
    const linkMatches = [];
    for (let i = 0; i < comments.length; i += 1) {
        const matchResult = comments[i].body.match(regularExpression);
        if (matchResult && !linkMatches.includes(matchResult[0])) {
            linkMatches.push(matchResult[0]);
        }
    }
    return linkMatches;
}

function getComments(url) {
    return rp.get({
        uri: url,
        headers,
        json: true,
    });
}

function postComment(url, message) {
    return rp.post({
        uri: url,
        headers,
        body: {
            body: message,
        },
        json: true,
    });
}

function postToClosedIssue(data) {
    const commentsUrl = `${data.issue.url}/comments`;

    // Return big Promise chain
    return getComments(commentsUrl)
    .then(comments => findLinksWithRegex(comments, /https:\/\/groups\.google\.com[^\s]*/ig))
    .then((linkMatches) => {
        if (linkMatches.length === 0) {
            console.log('No google group links found in comments!');
            return undefined;
        }
        console.log('Found these links in the comments: ', linkMatches);
        const message = `Please make sure to update ${linkMatches} on this closed issue.\n\n__I am a bot BEEEP BOOOP__`;
        return postComment(commentsUrl, message);
    })
    .then((status) => {
        console.log(`GitHub API returned with: ${status}`);
    })
    .catch(e => console.log(`Got an ERROR: ${e}`));
}

// Listen to `issues` WebHook
webHookHandler.on('issues', (repo, data) => {
    if (data.action !== 'closed') {
        return;
    }
    postToClosedIssue(data);
});

webHookHandler.on('error', (err, req, res) => { // eslint-disable-line no-unused-vars
    console.log('An error occurred: ', err);
});

// Listen to port specified by env.PORT
app.listen(app.get('port'), () => {
    console.log(`Forum-reminder listening on port ${app.get('port')}`);
});
