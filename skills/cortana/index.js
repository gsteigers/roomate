'use strict';
const DialogFlowSdk = require('apiai');
const restify = require('restify');
const builder = require('botbuilder');

const DIALOGFLOW_DEV_ACCESS_TOKEN = '<YOUR_ACCESS_TOKEN';

const DialogFlow = new DialogFlowSdk(DIALOGFLOW_DEV_ACCESS_TOKEN);

var isSessionActive = false;

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

const helpers = {
    getSpeechFromDFResponse: function(response) {
        return response.result.fulfillment.speech;
    },

    getTextFromRequest: function(request) {
        return request.intent.slots[CATCH_ALL_SLOT_NAME].value;
    },

    isInteractionAlive: function(responseResult) {
        if (responseResult.actionIncomplete)
            return true;

        let contexts = responseResult.contexts;
        for (let i = 0; i < contexts.length; i++)
            if (contexts[i].lifespan > 1)
                return true;

        return false;
    }
};

const handlers = {
    LaunchRequest: function(session) {
        let self = this;
        DialogFlow.eventRequest({name: 'WELCOME'}, {sessionId: "cortanaSessionId"})
            .on('response', function(response) {
                let speech = helpers.getSpeechFromDFResponse(response);
                session.send(speech);
            })
            .on('error', function(error) {
                console.error(error.message);
                session.send(error.message);
            })
            .end();
    },
    // forward the text that Alexa converted from the user's speech
    DeferToDFIntent: function(session) {
        let self = this;
        let text = session.message.text;
        if (!text) {
            //TODO: handle reprompt
            return;
        }

        DialogFlow.textRequest(text, {sessionId: "cortanaSessionId"})
            .on('response', function(response) {
                console.log(response);
                let speech = helpers.getSpeechFromDFResponse(response);
                session.send(speech);
            })
            .on('error', function(error) {
                console.error(error.message);
                session.send(error.message);
            })
            .end();
    }
}

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var bot = new builder.UniversalBot(connector, function (session) {
    console.log(this.isSessionActive);
    if(!this.isSessionActive) {
        this.isSessionActive = true;
        handlers.LaunchRequest(session);
    } else {
        handlers.DeferToDFIntent(session);
    }
});