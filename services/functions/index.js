'use strict';

const firebase = require('firebase-admin');
const functions = require('firebase-functions');

const DialogflowApp = require('actions-on-google').DialogflowApp;

const googleRequest = "google";
const alexaRequest = "alexa";
const slackRequest = "slack";

// a. the action name from the make_name Dialogflow intent
const CREATE_ROOM_ACTION = "create.room"
const PICK_ROOM_ACTION = "pick.room";
const CREATE_POST_ACTION = "create.post";
const GET_POST_ACTION = "get.post";

// b. the parameters that are parsed from the make_name intent 
const ROOM_ARG = 'room';
const PASSWORD_ARG = "password";
const NEW_POST = 'post';

const NO_INPUTS = [
    'I didn\'t hear that.',
    'If you\'re still there, say that again.',
    'We can stop here. See you soon.'
  ];

firebase.initializeApp(functions.config().firebase);

exports.Roomate = functions.https.onRequest((request, response) => {
    const app = new DialogflowApp({request, response});
    console.log('Request headers: ' + JSON.stringify(request.headers));
    console.log('Request body: ' + JSON.stringify(request.body));

    if (request.body.result) {
      processV1Request(request, response);
    } else if (request.body.queryResult) {
      processV2Request(request, response);
    } else {
      console.log('Invalid Request');
      return response.status(400).end('Invalid Webhook Request (expecting v1 or v2 webhook request)');
    }
});

function processV1Request (request, response) {
    console.log("Proccessing v1 request");
    let action = request.body.result.action; 
    let parameters = request.body.result.parameters;
    let inputContexts = request.body.result.contexts[1];
    let requestSource = (request.body.originalRequest) ? request.body.originalRequest.source : undefined;

    console.log("Action: " + action);
    console.log("Parameters: " + JSON.stringify(parameters));
    console.log("InputContexts: " + JSON.stringify(inputContexts));
    console.log("RequestSource: " + requestSource);
  
    const app = new DialogflowApp({request: request, response: response});
  
    // Create handlers for Dialogflow actions as well as a 'default' handler
    const actionHandlers = {
      'pick.room': (context) => {
        console.log("Before calling checkRoom - context: " + context);
        pickRoomHandler(context);
      },
      'check.password': (context) => {
        console.log("Before calling checkPassword - context: " + context);
        checkPasswordHandler(context);
      },
      'create.post': (context) => {
          console.log("Before calling createPostHandler - context: " + context);
          createPostHandler(context);
      },
      'get.post': (context) => {
        console.log("Before calling getRecentPostHandler - context: " + context);
        getRecentPostHandler(context);
      },
      'default': (context) => { // Default handler for unknown or undefined actions
        console.log("Fall to default - action: " + action);
        if (requestSource === googleRequest) {
          let responseToUser = {
            //googleRichResponse: googleRichResponse, // Optional, uncomment to enable
            //googleOutputContexts: ['weather', 2, { ['city']: 'rome' }], // Optional, uncomment to enable
            speech: 'This message is from Dialogflow\'s Cloud Functions for Firebase editor!', // spoken response
            text: 'This is from Dialogflow\'s Cloud Functions for Firebase editor! :-)' // displayed response
          };
          sendGoogleResponse(responseToUser);
        } else {
          let responseToUser = {
            //data: richResponsesV1, // Optional, uncomment to enable
            //outputContexts: [{'name': 'weather', 'lifespan': 2, 'parameters': {'city': 'Rome'}}], // Optional, uncomment to enable
            speech: 'This message is from Dialogflow\'s Cloud Functions for Firebase editor!', // spoken response
            text: 'This is from Dialogflow\'s Cloud Functions for Firebase editor! :-)' // displayed response
          };
          sendResponse(responseToUser);
        }
      }
    };
  
    // If undefined or unknown action use the default handler
    if (!actionHandlers[action]) {
      action = 'default';
    }
  
    // Run the proper handler function to handle the request from Dialogflow
    actionHandlers[action](inputContexts);

    //Helpers
    function checkRoom(room, callback) {
        console.log("rooms/" + room);
        var roomsRef = firebase.database().ref('rooms/' + room);
        roomsRef.once('value', function(snapshot) {
            console.log("I have received a snapshot: " + snapshot + " - " + JSON.stringify(snapshot));
            if(snapshot !== undefined) {
                var value = snapshot.val();
                console.log("snapshot value = " + value + " - " + JSON.stringify(value));
                if(value !== null) {
                    callback({room: room, isRoom: true});
                } else {
                    callback({room: room, isRoom: false});
                }
                
            }
        });
    }

    function checkRoomPassword(room, password, user, callback) {
        console.log("rooms/" + room);
        var roomsRef = firebase.database().ref('rooms/' + room);
        roomsRef.once('value', function(snapshot) {
            console.log("I have received a snapshot: " + JSON.stringify(snapshot));
            if(snapshot !== undefined) {
                var value = snapshot.val();
                console.log("snapshot value = " + JSON.stringify(value));
                console.log("Correct password: " + value.password.toLowerCase());
                console.log("Said password:" + password.toLowerCase());
                var isCorrect = value.password.toLowerCase() === password.toLowerCase();
                callback({room: room, correct: isCorrect});
            }
        });
    }

    function insertRoom(room, password, user) {
        console.log("Room = " + room + "Password = " + password + " User = " + user);
        firebase.database().ref('rooms/').push().set({
            room: {
                password: password
            }
        });
    }

    function insertPost(room, password, user, post) {
        console.log("Room = " + room + " User = " + user + " Post = " + post);
        firebase.database().ref('rooms/' + room + '/posts/').push().set({
            user: user,
            post: post
        });
    }

    function retrievePost(room, password, user, callback) {
        console.log("rooms/" + room + "/posts");
        var roomPostsRef = firebase.database().ref('rooms/' + room + '/posts');
        roomPostsRef.limitToLast(1).on('value', function(snapshot) {
            console.log("I have received a snapshot");
            console.log(snapshot.val());
            snapshot.forEach(function(post) {
                if(post !== null) {
                    let recentPost = post.val();
                    console.log(recentPost.post);
                    console.log(recentPost.user);
                    callback(recentPost);
                }
            });
        });
    }
    
    // Handlers
    function createRoomHandler(context) {
        console.log("CreateRoomHandler called");
        console.log("Context: " + context);
        let room = context.parameters.room;
        let password = context.parameters.password;
        let user = "garren";

        console.log("Room: " + room);
        console.log("Password: " + password);
        console.log("User: " + user);

        let saying = "";
        if(room === null) {
            saying += "The room is undefined";
        } else {
            insertRoom(room, password, user);
            saying += "I have added the following to room " + room + ": " + post;
        }

        console.log(saying);

        sendResponse(saying + ". What would you like to do next?");
        // if(requestSource === "slack") {
        //     sendResponse(saying + ". What would you like to do next?");
        // } else {
        //     sendGoogleResponse({speech: saying + ". What would you like to do next?"});
        // }
    }

    function pickRoomHandler(context) {
        console.log("checkPasswordHandler called");
        console.log("Context: " + context);
        let room = context.parameters.room;

        console.log("Room: " + room);

        let onCheck = function(response) {
            console.log("checkRoom - callback");
            let msg = "";
            if(response.isRoom) {
                msg = "You are trying to enter " + response.room + "! What is the password?";
            } else {
                msg = "The room " + response.room + " does not exist. Try a different room or try creating a new room";
            }

            console.log("msg: " + msg);
            sendResponse(msg);
            // if(requestSource === "slack") {
            //     sendResponse(saying + ". What would you like to do next?");
            // } else {
            //     sendGoogleResponse({speech: saying + ". What would you like to do next?"});
            // }
        }

        let saying = "";
        if(room === null) {
            saying += "The room is undefined. Please specify a room.";
            console.log(saying);
            app.ask(saying);
        } else {
            checkRoom(room, onCheck);
        }
    }

    function checkPasswordHandler(context) {
        console.log("checkPasswordHandler called");
        console.log("Context: " + context);
        let room = context.parameters.room;
        let password = context.parameters.password;
        let user = "garren";

        console.log("Room: " + room);
        console.log("Password: " + password);
        console.log("User: " + user);

        let onCheck = function(response) {
            console.log("checkPassword - callback");
            let msg = "";
            if(response.correct) {
                msg = "The password was correct! You are now in room " + response.room + ". What would you like to do?";
            } else {
                msg = "The password was incorrect! Please enter the correct password.";
            }

            console.log("msg: " + msg);
            sendResponse(msg);
            // if(requestSource === "slack" || requestSource === "facebook") {
            //     sendResponse({speech: msg + ". What would you like to do next?"});
            // } else {
            //     sendGoogleResponse({speech: msg + ". What would you like to do next?"});  
            // }
        }

        let saying = "";
        if(room === null) {
            saying += "The room is undefined. Please specify a room.";
            console.log(saying);
            app.ask(saying);
        } else {
            checkRoomPassword(room, password, user, onCheck);
        }
    }

    function createPostHandler(context) {
        console.log("CreatePostHandler called");
        console.log("Context: " + context);
        let room = context.parameters.room;
        let password = context.parameters.password;
        let user = "garren";
        let post = context.parameters.post;

        console.log("Room: " + room);
        console.log("Password: " + password);
        console.log("User: " + user);
        console.log("Post: " + post);

        let saying = "";
        if(room === null) {
            saying += "The room is undefined";
        } else {
            insertPost(room, password, user, post);
            saying += "I have added the following to room " + room + ": " + post;
        }

        console.log(saying);

        sendResponse(saying + ". What would you like to do next?");
        // if(requestSource === "slack") {
        //     sendResponse(saying + ". What would you like to do next?");
        // } else {
        //     sendGoogleResponse({speech: saying + ". What would you like to do next?"});
        // }
    }

    function getRecentPostHandler(context) {
        console.log("GetRecentPostHandler called");
        console.log("Context: " + context);
        let room = context.parameters.room;
        let password = context.parameters.password;
        let user = "garren";

        console.log("Room: " + room);
        console.log("Password: " + password);
        console.log("User: " + user);

        let onRetrieve = function(post) {
            let msg = "";
            if(post !== null) {
                msg = "Here is the latest post by " + post.user + ". " + post.post;
            } else {
                msg = "Failed to retrieve the latest post. Try again later"
            }

            sendResponse(msg + ". What would you like to do next?");
            // if(requestSource === "slack" || requestSource === "facebook") {
            //     sendResponse({speech: msg + ". What would you like to do next?"});
            // } else {
            //     sendGoogleResponse({speech: msg + ". What would you like to do next?"});  
            // }
        }

        let saying = "";
        if(room === null) {
            saying += "The room is undefined. Please specify a room.";
            console.log(saying);
            app.ask(saying);
        } else {
            retrievePost(room, password, user, onRetrieve);
        }
    }

    //Respond
    function sendResponse (responseToUser) {
        console.log("SENDING RESPONSE - " + responseToUser);
        // if the response is a string send it as a response to the user
        if (typeof responseToUser === 'string') {
        let responseJson = {};
        responseJson.speech = responseToUser; // spoken response
        responseJson.displayText = responseToUser; // displayed response
        response.json(responseJson); // Send response to Dialogflow
        } else {
        // If the response to the user includes rich responses or contexts send them to Dialogflow
        let responseJson = {};
        // If speech or displayText is defined, use it to respond (if one isn't defined use the other's value)
        responseJson.speech = responseToUser.speech || responseToUser.displayText;
        responseJson.displayText = responseToUser.displayText || responseToUser.speech;
        // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
        responseJson.data = responseToUser.data;
        // Optional: add contexts (https://dialogflow.com/docs/contexts)
        responseJson.contextOut = responseToUser.outputContexts;

        console.log('Response to Dialogflow: ' + JSON.stringify(responseJson));
        response.json(responseJson); // Send response to Dialogflow
        }
    }

    function sendGoogleResponse (responseToUser) {
        if (typeof responseToUser === 'string') {
        app.ask(responseToUser); // Google Assistant response
        } else {
        // If speech or displayText is defined use it to respond
        let googleResponse = app.buildRichResponse().addSimpleResponse({
            speech: responseToUser.speech || responseToUser.displayText,
            displayText: responseToUser.displayText || responseToUser.speech
        });
        // Optional: Overwrite previous response with rich response
        if (responseToUser.googleRichResponse) {
            googleResponse = responseToUser.googleRichResponse;
        }
        // Optional: add contexts (https://dialogflow.com/docs/contexts)
        if (responseToUser.googleOutputContexts) {
            app.setContext(...responseToUser.googleOutputContexts);
        }

        console.log('Response to Dialogflow (AoG): ' + JSON.stringify(googleResponse));
        app.ask(googleResponse); // Send response to Dialogflow and Google Assistant
        }
    }
}
  