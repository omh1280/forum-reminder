const { json } = require('body-parser');
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
app.use(json());
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

async function getComments(uri) {
    return rp.get({
        uri,
        headers,
        json: true,
    });
}

async function postComment(uri, message = '') {
    return rp.post({
        uri,
        headers,
        body: {
            body: message,
        },
        json: true,
    });
}

async function postToClosedIssue(data) {
    try {
        const commentsUrl = `${data.issue.url}/comments`;

        const comments = await getComments(commentsUrl);
        const linkMatches = findLinksWithRegex(comments, /https:\/\/groups\.google\.com[^\s]*/ig);

        if (linkMatches.length === 0) {
            console.log('No google group links found in comments!');
            return;
        }
        console.log('Found these links in the comments: ', linkMatches);
        const status = await postComment(commentsUrl, `Please make sure to update ${linkMatches} on this closed issue.\n\n__I am a bot BEEEP BOOOP__`);
        console.log(`GitHub API returned with: ${status}`);
    } catch (e) {
        console.log(`Got an error: ${e}`);
    }
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
