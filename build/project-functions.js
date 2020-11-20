// Package Definitions
//TODO: For startup speed, move these to when they are used.
const syncClient = require('sync-rest-client');
const fs = require('file-system');
//const fse = require('fs-extra');
const jsonfile = require('jsonfile');
const isWindows = process.platform == 'win32';
const clURI = require('./../config-cloud.json').endpoints;
const mappings = require('./../config-cloud.json').mappings;

// Clean temp folder
cleanTemp = function () {
    log(INFO, 'Cleaning Temp Directory: ' + getProp('Workspace_TMPFolder'));
    return deleteFolder(getProp('Workspace_TMPFolder'));
}

// Function that determines which cloud login method to use
// function to login to the cloud
let loginC = null;
// var useOAuth = false;
const argv = require('yargs').argv;
let cloudURL = getProp('Cloud_URL');
let cloudHost = getProp('cloudHost');
// Check if a global config exists and if it is required
//TODO: Manage global config in common functions
if (getGlobalConfig()) {
    const propsG = getGlobalConfig();
    if (cloudURL == 'USE-GLOBAL') {
        cloudURL = propsG.Cloud_URL;
    }
    if (cloudHost == 'USE-GLOBAL') {
        cloudHost = propsG.cloudHost;
    }
}

const colors = require('colors');
//Function to manage the login from the cloud
let loginURL = cloudURL + getProp('loginURE');
let doOAuthNotify = true;
let isOAUTHValid = false;
let toldClientID = false;

cLogin = function (tenant, customLoginURL, forceClientID) {
    const fClientID = forceClientID || false;
    if (isOauthUsed() && !fClientID) {
        log(DEBUG, 'Using OAUTH for Authentication...');
        // isOAUTHValid = true;
        // Getting the organization info
        // console.log('Get Org: ' , getOrganization());
        if (getOrganization() == null || getOrganization().trim() == '') {
            // Setting this to temp so it breaks the call stack
            // setOrganization('TEMP');
            var response = callURL('https://' + getCurrentRegion() + clURI.account_info, null, null, null, false, null, null, null, true);
            log(DEBUG, 'Got Account info: ', response);
            if (response == 'Unauthorized') {
                log(ERROR, 'OAUTH Token Invalid... Falling back to Normal Authentication. Consider rotating your OAUTH Token or generate a new one... ');
                // process.exit();
            }
            if (response.selectedAccount) {
                if (doOAuthNotify) {
                    log(INFO, 'Using OAUTH Authentication, ORGANIZATION: ' + colors.blue(response.selectedAccount.displayName));
                    doOAuthNotify = false;
                }

                setOrganization(response.selectedAccount.displayName);
                isOAUTHValid = true;
            }
        }
    }
    if (!isOauthUsed() || !isOAUTHValid || fClientID) {
        if (!toldClientID) {
            log(INFO, 'Using CLIENT-ID Authentication...');
            toldClientID = true;
        }
        var setLoginURL = loginURL;
        if (customLoginURL) {
            setLoginURL = customLoginURL;
            // Delete the previous cookie on a custom login
            loginC = null;
        }

        var tentantID = getProp('CloudLogin.tenantID');
        if (tenant) {
            tentantID = tenant;
        }
        //TODO: Set a timer, if login was too long ago login again...
        var pass = getProp('CloudLogin.pass');
        var clientID = getProp('CloudLogin.clientID');
        var email = getProp('CloudLogin.email');
        //
        //TODO: Manage global config in common functions
        if (getGlobalConfig()) {
            const propsG = getGlobalConfig();
            if (pass == 'USE-GLOBAL') pass = propsG.CloudLogin.pass;
            if (tentantID == 'USE-GLOBAL') tentantID = propsG.CloudLogin.tenantID;
            if (clientID == 'USE-GLOBAL') clientID = propsG.CloudLogin.clientID;
            if (email == 'USE-GLOBAL') email = propsG.CloudLogin.email;
        }

        if (pass == '') {
            pass = argv.pass;
            // console.log('Pass from args: ' + pass);
        }
        if (pass.charAt(0) == '#') {
            pass = Buffer.from(pass, 'base64').toString()
        }
        if (loginC == null) {
            loginC = cloudLoginV3(tentantID, clientID, email, pass, setLoginURL);
        }
        if (loginC == 'ERROR') {
            // TODO: exit the gulp task properly
            log(INFO, 'Error Exiting..');
            process.exit(1);
        }
        // console.log("RETURN: " , loginC);
    }
    return loginC;
}


// Function that logs into the cloud and returns a cookie
function cloudLoginV3(tenantID, clientID, email, pass, TCbaseURL) {
    var postForm = 'TenantId=' + tenantID + '&ClientID=' + clientID + '&Email=' + email + '&Password=' + pass;
    log(DEBUG, 'cloudLoginV3]   URL: ' + TCbaseURL);
    log(DEBUG, 'cloudLoginV3]  POST: ' + 'TenantId=' + tenantID + '&ClientID=' + clientID + '&Email=' + email);
    //log(DEBUG,'With Form: ' + postForm);
    var response = syncClient.post(encodeURI(TCbaseURL), {
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        payload: postForm
    });
    var re = '';
    //console.log(response.body);
    if (response.body.errorMsg != null) {
        log(ERROR, response.body.errorMsg);
        re = 'ERROR';
    } else {
        if (response.body.orgName) {
            setOrganization(response.body.orgName);
        }
        var loginCookie = response.headers['set-cookie'];
        logO(DEBUG, loginCookie);
        var rxd = /domain=(.*?);/g;
        var rxt = /tsc=(.*?);/g;
        re = {"domain": rxd.exec(loginCookie)[1], "tsc": rxt.exec(loginCookie)[1]};
        logO(DEBUG, re.domain);
        logO(DEBUG, re.tsc);
        logO(DEBUG, re);
        log(INFO, 'Login Successful of ' + email + '(' + tenantID + ')...');
    }
    return re;
}

getRegion = function () {
    let re = 'US';
    let myHost = getProp('cloudHost').toString().toUpperCase();
    if (myHost.includes('EU.')) {
        re = 'EU';
    }
    if (myHost.includes('AU.')) {
        re = 'AU';
    }
    return re;
}

cleanDist = function () {
    return deleteFolder('./dist/' + getProp('App_Name'));
}

// Add Descriptor
let ADD_DESCRIPTOR = 'YES';
if (getProp('Add_Descriptor') != null) {
    ADD_DESCRIPTOR = getProp('Add_Descriptor');
} else {
    log(INFO, 'No Add_Descriptor Property found; Adding Add_Descriptor to ' + getPropFileName());
    addOrUpdateProperty(getPropFileName(), 'Add_Descriptor', 'YES');
}
// Add Descriptor
let ADD_DESCRIPTOR_TIMESTAMP = 'YES';
if (getProp('Add_Descriptor_Timestamp') != null) {
    ADD_DESCRIPTOR_TIMESTAMP = getProp('Add_Descriptor_Timestamp');
} else {
    log(INFO, 'No Add_Descriptor_Timestamp Property found; Adding Add_Descriptor_Timestamp to ' + getPropFileName());
    addOrUpdateProperty(getPropFileName(), 'Add_Descriptor_Timestamp', 'YES');
}
// Add Descriptor
let DESCRIPTOR_FILE = './src/assets/cloudstarter.json';
if (getProp('Descriptor_File') != null) {
    DESCRIPTOR_FILE = getProp('Descriptor_File');
} else {
    log(INFO, 'No Descriptor_File Property found; Adding Descriptor_File to ' + getPropFileName());
    addOrUpdateProperty(getPropFileName(), 'Descriptor_File', './src/assets/cloudstarter.json');
}

generateCloudDescriptor = function () {
    log(INFO, 'Adding descriptor file: ' + DESCRIPTOR_FILE + ' Adding Timestamp: ' + ADD_DESCRIPTOR_TIMESTAMP);
    // Get the version from the JSON File
    const workdir = process.cwd();
    const packageJson = workdir + '/package.json';
    if (doesFileExist(packageJson)) {
        let now = "";
        let buildOn = "";
        if (ADD_DESCRIPTOR_TIMESTAMP === 'YES') {
            now = (new Date()).getTime();
            buildOn = new Date();
        }
        const pJsonObj = require(packageJson);
        let name = "";
        if (pJsonObj.name) {
            name = pJsonObj.name;
        }
        let version = "";
        if (pJsonObj.version) {
            version = pJsonObj.version;
        }
        let description = "";
        if (pJsonObj.description) {
            description = pJsonObj.description;
        }
        let csObject = {
            cloudstarter: {
                name: name,
                version: version + now,
                build_date: buildOn,
                description: description
            }
        }
        log(INFO, 'Adding Cloud Starter Descriptor: ', csObject);
        const storeOptions = {spaces: 2, EOL: '\r\n'};
        jsonfile.writeFileSync(DESCRIPTOR_FILE, csObject, storeOptions);

    } else {
        log(ERROR, packageJson + ' File not found...');
    }
    // Possibly add timestamp
    //TODO: Possibly use a descriptor template
    //TODO: Possibly add dependencies into the file
}

// Function to display the location on the deployed cloudstarter and possilby the descriptor.
showAppLinkInfo = function () {
    //TODO: Get from global file
    let cloudURLdisp = getProp('Cloud_URL');
    log('INFO', "LOCATION: " + cloudURLdisp + "webresource/apps/" + getProp('App_Name') + "/index.html");
    if (getProp('Add_Descriptor') == 'YES') {
        log('INFO', "DESCRIPTOR LOCATION: " + cloudURLdisp + "webresource/apps/" + getProp('App_Name') + getProp('Descriptor_File').replace('./src', ''));
    }
}

// Check for Build Command
let BUILD_COMMAND = 'HASHROUTING';
if (getProp('BUILD_COMMAND') != null) {
    BUILD_COMMAND = getProp('BUILD_COMMAND');
} else {
    log(INFO, 'No BUILD_COMMAND Property found; Adding BUILD_COMMAND to ' + getPropFileName());
    addOrUpdateProperty(getPropFileName(), 'BUILD_COMMAND', 'HASHROUTING', 'Build command to use: Options: HASHROUTING | NON-HASHROUTING | <a custom command (example: ng build --prod )>');
}


buildCloudStarterZip = function (cloudStarter) {
    return new Promise(async function (resolve, reject) {
        const csURL = '/webresource/apps/' + cloudStarter + '/';
        deleteFile('./dist/' + cloudStarter + '.zip');
        //Add the cloudstarter.json file
        if (getProp('Add_Descriptor') === 'YES') {
            generateCloudDescriptor();
        }
        //hashrouting build configurable
        let buildCommand = BUILD_COMMAND;
        let bType = 'CUSTOM';
        if (BUILD_COMMAND === 'HASHROUTING') {
            bType = 'HASHROUTING';
            buildCommand = 'ng build --prod --base-href ' + csURL + 'index.html --deploy-url ' + csURL;
        }
        if (BUILD_COMMAND === 'NON-HASHROUTING') {
            bType = 'NON-HASHROUTING';
            buildCommand = 'ng build --prod --base-href ' + csURL + ' --deploy-url ' + csURL;
        }
        log(INFO, 'Building Cloudstarter Using Command(Type: ' + bType + '): ' + buildCommand);
        run(buildCommand);
        //TODO: Use NPM to zip a folder, fix bug on extraction when upload to cloud... (perhaps use no compression)
        //const folderToZip = './dist/' + cloudStarter + '/';
        //const fileForZip = './dist/' + cloudStarter + '.zip';
        run('cd ./dist/' + cloudStarter + '/ && zip -r ./../' + cloudStarter + '.zip .');
        log(INFO, 'ZIP Created: ./dist/' + cloudStarter + '.zip');
        resolve();
    });
}


// function that shows all the availible applications in the cloud
const getAppURL = cloudURL + getProp('appURE') + '?$top=200';
showAvailableApps = function (showTable) {
    //TODO: Use table config
    var doShowTable = (typeof showTable === 'undefined') ? false : showTable;
    var response = callURL(getAppURL);
    //console.log('APPS: ' , response);
    // TODO: Apparently apps can have tags, look into this...
    var apps = {};
    for (var app in response) {
        var appTemp = {};
        var appN = parseInt(app) + 1;
        //log(INFO, appN + ') APP NAME: ' + response[app].name  + ' Published Version: ' +  response[app].publishedVersion + ' (Latest:' + response[app].publishedVersion + ')') ;
        appTemp['APP NAME'] = response[app].name;
        //appTemp['LINK'] = 'https://eu.liveapps.cloud.tibco.com/webresource/apps/'+response[app].name+'/index.html';
        // TODO: Use the API (get artifacts) to find an index.htm(l) and provide highest
        // TODO: Use right eu / us link
        var publV = parseInt(response[app].publishedVersion);
        appTemp['PUBLISHED VERSION'] = publV;
        var latestV = parseInt(response[app].latestVersion);
        appTemp['LATEST VERSION'] = latestV;
        //appTemp['PUBLISHED / LATEST VERSION'] = '(' + publV + '/' + latestV + ')';
        var latestDeployed = false;
        if (publV == latestV) {
            latestDeployed = true;
        }
        appTemp['LATEST DEPLOYED'] = latestDeployed;
        apps[appN] = appTemp;
        var created = new Date(response[app].creationDate);
        var options = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'};
        var optionsT = {hour: 'numeric'};
        appTemp['CREATED'] = created.toLocaleDateString("en-US", options);
        //appTemp['CREATED TIME'] = created.toLocaleTimeString();
        var lastModified = new Date(response[app].lastModifiedDate);
        //appTemp['LAST MODIFIED'] = lastModified.toLocaleDateString("en-US", options);
        //appTemp['LAST MODIFIED TIME'] = lastModified.toLocaleTimeString();
        var now = new Date();
        appTemp['AGE(DAYS)'] = Math.round((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        appTemp['LAST MODIFIED(DAYS)'] = Math.round((now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24));
    }
    //logO(INFO,apps);
    // if (doShowTable) console.table(apps);
    pexTable(apps, 'cloud-starters', getPEXConfig(), doShowTable);
    return response;
    // resolve();
    // });
};

showApps = function () {
    return new Promise(function (resolve, reject) {
        showAvailableApps(true);
        resolve();
    });
}


// Function to show claims for the configured user
const getClaimsURL = cloudURL + getProp('Claims_URE');
showCloudInfo = function (showTable) {
    return new Promise(function (resolve, reject) {
        let doShowTable = true;
        if (showTable != null) {
            doShowTable = showTable;
        }
        var response = callURL(getClaimsURL);
        let nvs = createTableValue('REGION', getRegion());
        nvs = createTableValue('ORGANIZATION', getOrganization(), nvs);
        nvs = createTableValue('FIRST NAME', response.firstName, nvs);
        nvs = createTableValue('LAST NAME', response.lastName, nvs);
        nvs = createTableValue('EMAIL', response.email, nvs);
        if (response.sandboxes) {
            for (var i = 0; i < response.sandboxes.length; i++) {
                nvs = createTableValue('SANDBOX ' + i, response.sandboxes[i].type, nvs);
                nvs = createTableValue('SANDBOX ' + i + ' ID', response.sandboxes[i].id, nvs);
            }
        }
        // TODO: display groups
        if (doShowTable) {
            console.table(nvs);
        }
        resolve();
    });
};

doDeleteApp = function (appToDelete) {
    const location = cloudURL + 'webresource/v1/applications/' + appToDelete + '/';
    return callURL(location, 'DEL');
}


//TODO: Move this to prop file
const sharedStateBaseURL = cloudURL + 'clientstate/v1/';
const sharedStateURL = sharedStateBaseURL + 'states';
const SHARED_STATE_STEP_SIZE = 400;
const SHARED_STATE_MAX_CALLS = 20;

// Shared state scope (picked up from configuration if exists)
let SHARED_STATE_SCOPE = 'APPLICATION';
if (getProp('Shared_State_Scope') != null) {
    SHARED_STATE_SCOPE = getProp('Shared_State_Scope');
} else {
    log(INFO, 'No Shared State Scope Property found; Adding APPLICATION to ' + getPropFileName());
    addOrUpdateProperty(getPropFileName(), 'Shared_State_Scope', 'APPLICATION');
}

// Shared state scope (picked up from configuration if exists)
let SHARED_STATE_DOUBLE_CHECK = 'YES';
if (getProp('Shared_State_Double_Check') != null) {
    SHARED_STATE_DOUBLE_CHECK = getProp('Shared_State_Double_Check');
} else {
    log(INFO, 'No Shared State Scope Double Check Property found; Adding YES to ' + getPropFileName());
    addOrUpdateProperty(getPropFileName(), 'Shared_State_Double_Check', 'YES');
}
const DO_SHARED_STATE_DOUBLE_CHECK = (!(SHARED_STATE_DOUBLE_CHECK.toLowerCase() == 'no'));


// Function to return a JSON with the shared state entries from a set scope
getSharedState = function (showTable) {
    var lCookie = cLogin();
    log(DEBUG, 'Login Cookie: ', lCookie);
    //TODO: Think about applying a filter when getting the entries (instead of client side filtering)
    let ALLsState = [];
    var i = 0;
    let moreStates = true;
    let filterType = 'PUBLIC';
    if (getProp('Shared_State_Type') != null) {
        filterType = getProp('Shared_State_Type');
    }
    log(INFO, 'Type of Shared State: ' + colors.blue(filterType));
    while (moreStates && i < SHARED_STATE_MAX_CALLS) {
        let start = i * SHARED_STATE_STEP_SIZE;
        let end = (i + 1) * SHARED_STATE_STEP_SIZE;
        //log(INFO, 'Getting shared state entries from ' + start + ' till ' + end);
        //TODO: Also get Shared shared states (+ '&filter=type = SHARED')
        //TODO: Rename scope for shared state
        let filter = '&$filter=type=' + filterType;
        let sStateTemp = callURL(sharedStateURL + '?$top=' + SHARED_STATE_STEP_SIZE + '&$skip=' + start + filter, null, null, null, false);
        if (sStateTemp.length < 1) {
            moreStates = false;
        }
        //log(INFO, 'Got ' + sStateTemp.length);
        ALLsState = ALLsState.concat(sStateTemp);
        i++;
        logLine('Got Shared States: ' + ALLsState.length);
    }
    console.log('');
    log(INFO, 'Total Number of Shared State Entries: ' + ALLsState.length);
    if (SHARED_STATE_SCOPE == 'APPLICATION') {
        SHARED_STATE_SCOPE = getProp('App_Name');
    }
    let sState = [];
    log(INFO, 'Applying Filter) Shared State Scope: ' + SHARED_STATE_SCOPE);
    if (SHARED_STATE_SCOPE != '*') {
        for (var state in ALLsState) {
            if (ALLsState[state] && ALLsState[state].name && ALLsState[state].name.startsWith(SHARED_STATE_SCOPE)) {
                sState.push(ALLsState[state]);
            }
        }
    } else {
        sState = ALLsState;
    }
    log(INFO, 'Filtered Shared State Entries: ' + sState.length);
    //Sort shared state by old date till new
    sState.sort(function (a, b) {
        a = new Date(a.createdDate);
        b = new Date(b.createdDate);
        return a > b ? 1 : a < b ? -1 : 0;
    });
    var states = {};
    for (var state in sState) {
        var sTemp = {};
        var appN = parseInt(state) + 1;
        sTemp['ID'] = sState[state].id;
        sTemp['NAME'] = sState[state].name;
        sTemp['CREATED BY'] = sState[state].createdByName;
        var created = new Date(sState[state].createdDate);
        var options = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'};
        sTemp['CREATED ON'] = created.toLocaleDateString("en-US", options);
        sTemp['MODIFIED BY'] = sState[state].modifiedByName;
        var modified = new Date(sState[state].modifiedDate);
        sTemp['LAST MODIFIED'] = modified.toLocaleDateString("en-US", options);
        states[appN] = sTemp;
    }
    //if (showTable) {
    //    console.table(states);
    pexTable(states, 'shared-states', getPEXConfig(), showTable);
    //}
    return sState;
}

// Display the shared state entries to a user
showSharedState = function () {
    return new Promise(function (resolve, reject) {
        getSharedState(true);
        resolve();
    });
};

selectSharedState = async function (sharedStateEntries, question) {
    // console.log('Shared State Entries: ' , sharedStateEntries);
    var stateNames = [];
    for (var state of sharedStateEntries) {
        stateNames.push(state.name);
    }
    // console.log('Shared state names: ' , stateNames);
    // Pick Item from the list
    let answer = await askMultipleChoiceQuestionSearch(question, stateNames);
    let re = {};
    for (var state of sharedStateEntries) {
        if (state.name == answer) {
            re = state;
        }
    }
    return re;
}


// Display the details of a shared state
showSharedStateDetails = function () {
    return new Promise(async function (resolve, reject) {
        // Show Shared State list
        const sStateList = getSharedState(true);
        if (sStateList.length > 0) {
            // Pick Item from the list
            let selectedState = await selectSharedState(sStateList, 'Which Shared State do you like to get the Details from ?');
            // Show details on the item
            log(INFO, 'CONTEXT:' + selectedState.name + ' (' + selectedState.id + ')\n', selectedState, '\n------------------------------');
            log(INFO, 'JSON CONTENT: ' + selectedState.name + ' (' + selectedState.id + ')\n', JSON.parse(selectedState.content.json), '\n------------------------------');

            // Show Details:  /states/{id}
            // TODO: Think about:

            // Show Links From
            // Show Links To

            // Show Attributes
            // Show Attribute Details

            // Get Roles
            // Show Role Details

            // Show State Links
            // Show State Link Details
        } else {
            log(ERROR, 'No Shared States available to show details of in the scope: ' + getProp('Shared_State_Scope'))
        }

        resolve();
    });
};

deleteSharedState = function (sharedStateID) {
    //const lCookie = cLogin();
    //log(DEBUG, 'Login Cookie: ', lCookie);
    /*
    const response = syncClient.del(sharedStateURL + '/' + sharedStateID, {
        headers: {
            "accept": "application/json",
            "cookie": "tsc=" + lCookie.tsc + "; domain=" + lCookie.domain
        }
    });*/
    const response = callURL(sharedStateURL + '/' + sharedStateID, 'DEL');


    //var re = response;
    //let re = Object.assign({}, response.body);
    //logO(INFO, re);
    let ok = true;
    if (response != null) {
        if (response.errorMsg != null) {
            log(ERROR, response.errorMsg);
            ok = false;
        }
    }
    if (ok) {
        log(INFO, 'Successfully removed shared state with ID: ' + sharedStateID);
    }
}

// Removes a Shared State Entry
removeSharedStateEntry = function () {
    return new Promise(async function (resolve, reject) {
        // Show Shared State list
        const sStateList = getSharedState(true);
        if (sStateList.length > 0) {
            // Pick Item from the list
            let selectedState = await selectSharedState(sStateList, 'Which Shared State would you like to remove ?');
            log(INFO, 'Removing Shared State: ' + selectedState.name + ' (' + selectedState.id + ')');
            // Ask if you really want to delete the selected shared state entry
            let decision = 'YES';
            if (DO_SHARED_STATE_DOUBLE_CHECK) {
                decision = await askMultipleChoiceQuestion('Are you sure ?', ['YES', 'NO']);
            }
            // console.log(decision);
            // Remove shared state entry
            if (decision == 'YES') {
                deleteSharedState(selectedState.id);
                //deleteSharedState(8088);

            } else {
                log(INFO, 'Don\'t worry I have not removed anything :-) ... ');
            }
        } else {
            log(ERROR, 'No Shared States available to remove in the scope: ' + getProp('Shared_State_Scope'))
        }
        resolve();
    });
};

// Removes a Shared State Scope
clearSharedStateScope = function () {
    return new Promise(async function (resolve, reject) {
        // Show Shared State list
        const sStateList = getSharedState(true);
        if (sStateList.length > 0) {
            // Ask if you really want to delete this shared state scope
            let decision = 'YES';

            if (DO_SHARED_STATE_DOUBLE_CHECK) {
                decision = await askMultipleChoiceQuestion('ARE YOU SURE YOU WANT TO REMOVE ALL STATES ABOVE (From Scope: ' + getProp('Shared_State_Scope') + ') ?', ['YES', 'NO']);
            }
            // If the scope is set to * then really double check...
            if (getProp('Shared_State_Scope') == '*') {
                decision = 'NO';
                const secondDecision = await askMultipleChoiceQuestion('YOU ARE ABOUT TO REMOVE THE ENTIRE SHARED STATE ARE YOU REALLY REALLY SURE ? ', ['YES', 'NO']);
                if (secondDecision == 'YES') {
                    decision = 'YES';
                }
            }
            // Remove shared state entries
            if (decision == 'YES') {
                for (sStateToDelete of sStateList) {
                    // Remove entries one by one
                    log(INFO, 'REMOVING SHARED STATE - NAME: ' + sStateToDelete.name + ' ID: ' + sStateToDelete.id);
                    deleteSharedState(sStateToDelete.id);
                }
            } else {
                log(INFO, 'Don\'t worry I have not removed anything :-) ... ');
            }
        } else {
            log(ERROR, 'No Shared States available to remove in the scope: ' + getProp('Shared_State_Scope'))
        }
        resolve();
    });
};

// Shared state folder (picked up from configuration if exists)
let SHARED_STATE_FOLDER = './Shared_State/';
if (getProp('Shared_State_Folder') != null) {
    SHARED_STATE_FOLDER = getProp('Shared_State_Folder');
} else {
    addOrUpdateProperty(getPropFileName(), 'Shared_State_Folder', SHARED_STATE_FOLDER);
}


// Export the Shared state scope to a folder
exportSharedStateScope = function () {
    return new Promise(async function (resolve, reject) {
        // Show Shared State List
        let sharedStateEntries = getSharedState(true);
        let decision = 'YES';
        if (DO_SHARED_STATE_DOUBLE_CHECK) {
            decision = await askMultipleChoiceQuestion('Are you sure you want to export all the states above ?', ['YES', 'NO']);
        }
        if (decision == 'YES') {
            // Check if folder exist
            let ssExportFolder = SHARED_STATE_FOLDER;
            // TODO: think about setting up a structure with the organization (so that import get it directly from the right org)
            /*
            if(getOrganization() && getOrganization().trim() != ''){
                ssExportFolder = SHARED_STATE_FOLDER + getOrganization() + '/';
            } else {
                log(WARNING, 'No organization for folder export...');
            }*/

            mkdirIfNotExist(ssExportFolder);
            mkdirIfNotExist(ssExportFolder + 'CONTENT/');
            // Create 2 files per shared state: description (name of the state.json) and content ( name.CONTENT.json)
            const storeOptions = {spaces: 2, EOL: '\r\n'};
            for (let sSEntry of sharedStateEntries) {
                let writeContentSeparate = false;
                let contentObject = {};
                let contextFileName = ssExportFolder + sSEntry.name + '.json';
                let contentFileName = ssExportFolder + 'CONTENT/' + sSEntry.name + '.CONTENT.json';
                if (sSEntry.content != null) {
                    if (sSEntry.content.json != null) {
                        try {
                            // Get the details for every shared state entry
                            contentObject = JSON.parse(sSEntry.content.json);
                            sSEntry.content.json = {'FILESTORE': contentFileName};
                            writeContentSeparate = true;
                            // And store them in a file / folder
                            jsonfile.writeFileSync(contentFileName, contentObject, storeOptions);
                            log(INFO, '[STORED CONTENT]: ' + contentFileName);
                        } catch (e) {
                            log(ERROR, 'Parse Error on: ' + sSEntry.name + 'Writing directly...');
                        }
                    }
                }
                jsonfile.writeFileSync(ssExportFolder + sSEntry.name + '.json', sSEntry, storeOptions);
                log(INFO, '[STORED CONTEXT]: ' + contextFileName);
                if (!writeContentSeparate) {
                    log(ERROR, 'Stored all in: ' + contextFileName)
                }
            }
        } else {
            log(INFO, 'Don\'t worry I have not exported anything :-) ... ');
        }
        resolve();
    });
};

// Load shared state contents from a file
importSharedStateFile = function (ssFile) {
    log(DEBUG, 'Importing: ' + ssFile);
    var contentContextFile = fs.readFileSync(ssFile);
    var ssObject = {};
    try {
        ssObject = JSON.parse(contentContextFile);
    } catch (e) {
        log(ERROR, 'Parse Error on: ' + ssFile);
        log(ERROR, e);
        process.exit();
    }
    if (ssObject.content != null) {
        if (ssObject.content.json != null) {
            if (ssObject.content.json['FILESTORE'] != null) {
                const contentFile = ssObject.content.json['FILESTORE'];
                log(INFO, 'Getting content from: ' + contentFile);
                var contentContentFile = fs.readFileSync(contentFile, "utf8");
                // console.log('GOT: ' , contentContentFile);
                try {
                    ssObject.content.json = contentContentFile;
                } catch (e) {
                    log(ERROR, 'Parse Error on: ' + contentFile);
                    log(ERROR, e);
                    process.exit();
                }
                ssObject.content.json = ssObject.content.json;
            }
        }
    }
    // console.log(ssObject);
    return ssObject;
}

putSharedState = function (sharedStateObject) {
    if (sharedStateObject != null || sharedStateObject != '' || sharedStateObject != {}) {
        log(DEBUG, 'POSTING Shared State', sharedStateObject);
        /*const lCookie = cLogin();
        log(DEBUG, 'Login Cookie: ', lCookie);
        const response = syncClient.put(encodeURI(sharedStateURL), {
            headers: {
                "accept": "application/json",
                "cookie": "tsc=" + lCookie.tsc + "; domain=" + lCookie.domain
            },
            payload: [sharedStateObject]
        });*/
        callURL(sharedStateURL, 'PUT', [sharedStateObject]);
        //console.log(response.body);
        log(INFO, '\x1b[32m', 'Updated: ' + sharedStateObject.name)
        // var re = response;
        // TODO: Check for errors, and if the state does not exist use post..
    } else {
        log(ERROR, 'NOT Posting Empty Shared State: ', sharedStateObject)
    }
}

// Import the Shared state scope from a folder
importSharedStateScope = function () {
    return new Promise(async function (resolve, reject) {
            //console.log('ORG: ', getOrganization());
            let importOptions = [];
            // Go Over Shared State files
            var states = {};
            let it = 1;
            fs.readdirSync(SHARED_STATE_FOLDER).forEach(file => {
                if (file != 'CONTENT') {
                    importOptions.push(file);
                    var sTemp = {};
                    var appN = it;
                    sTemp['FILE'] = file;
                    states[appN] = sTemp;
                    it++;
                }
            });
            if (importOptions.length > 0) {
                log(INFO, 'Shared states found in: ' + SHARED_STATE_FOLDER);
                console.table(states);
                importOptions.unshift('ALL SHARED STATES');
                // Provide the option to select one or upload all
                let answer = await askMultipleChoiceQuestionSearch('Which shared state would you like to import', importOptions);
                if (answer == 'ALL SHARED STATES') {
                    // Import all shared states
                    for (curState of importOptions) {
                        if (curState != 'ALL SHARED STATES') {
                            // console.log('Updating: ' + SHARED_STATE_FOLDER + curState);
                            putSharedState(importSharedStateFile(SHARED_STATE_FOLDER + curState));
                        }
                    }
                } else {
                    putSharedState(importSharedStateFile(SHARED_STATE_FOLDER + answer));
                }
            } else {
                log(ERROR, 'No Shared States found for import in: ' + SHARED_STATE_FOLDER);
            }
            // TODO: Check which shared states will be overwritten
            // Provide a summary to the user
            // Ask if you are sure to import the shared state ?
            // Upload the shared states one by one
            resolve();
        }
    );
};

//wrapper function around the watcher on shared state
watchSharedStateScopeMain = function () {
    return new Promise(async function (resolve, reject) {
        //const commandSTDO = 'cd ' + __dirname  + '/../ && gulp watch-shared-state-scope-do --cwd "' + process.cwd() + '" --gulpfile "' + __dirname + '/../manage-project.js" --pass "' + getProp('CloudLogin.pass + '"';
        // console.log('propFileNameGl: ' + getPropFileName());
        //TODO: What if the password is not specified in properties file, needs to be send...
        const commandSTDO = 'tcli watch-shared-state-scope-do -p "' + getPropFileName() + '"';
        const decision = await askMultipleChoiceQuestion('Before you watch the files for changes, do you want to do an export of the latest shared state scope ?', ['YES', 'NO']);
        if (decision == 'YES') {
            exportSharedStateScope().then(() => {
                run(commandSTDO);
                resolve();
            })
        } else {
            run(commandSTDO);
            resolve();
        }
    });
}

//A shared state watcher (every time the file changes, the shared state is updated)
watchSharedStateScope = function () {
    const chokidar = require('chokidar');
    return new Promise(async function (resolve, reject) {
        //Do the login now, so it does not have to be done later
        cLogin();
        log(INFO, 'Waiting for FILE Changes in: ' + SHARED_STATE_FOLDER)
        const watcher = chokidar.watch(SHARED_STATE_FOLDER).on('all', (event, path) => {
            // console.log(event, path);
            if (event == 'change') {
                if (path.includes('/CONTENT/')) {
                    log(INFO, 'CONTENT File UPDATED: ' + path);
                    const contextFile = path.replace('/CONTENT/', '/').replace('.CONTENT.', '.');
                    // console.log(contextFile);
                    if (doesFileExist(contextFile)) {
                        putSharedState(importSharedStateFile(contextFile));
                    } else {
                        log(ERROR, 'Can\'t find context file: ' + contextFile);
                    }
                } else {
                    log(INFO, 'CONTEXT File UPDATED: ' + path);
                    log(INFO, 'NOTHING CHANGED; WE ARE NOT POSTING CONTEXT FILES CURRENTLY...');
                    //putSharedState(importSharedStateFile(path));
                }
            }

        });
        const readline = require('readline');
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        process.stdin.on('keypress', (str, key) => {
            if (key.ctrl && key.name === 'c') {
                process.exit();
            }
            // console.log(key);
            // console.log(key.name);
            if (key.name == 'escape' || key.name === 'q') {
                // console.log('ESCAPE...');
                resolve();
                watcher.close().then(() => {
                    log(INFO, 'Stopped Listening for File changes...');
                    process.exit();
                });
            }
        });
        console.log('Press Escape key or the \'q\'-key to stop listening for file changes...');
    });
};

// Get details from a specific Cloud URL

/*
getCloud = function (url) {
    const lCookie = cLogin();
    log(DEBUG, 'Login Cookie: ', lCookie);
    const response = syncClient.get(url, {
        headers: {
            "accept": "application/json",
            "cookie": "tsc=" + lCookie.tsc + "; domain=" + lCookie.domain
        }
    });
    var re = response.body;
    return re;
}*/

const getApplicationDetailsURL = cloudURL + getProp('appURE');
getApplicationDetails = function (application, version, showTable) {
    var doShowTable = (typeof showTable === 'undefined') ? false : showTable;
    var details = {};
    //console.log(getApplicationDetailsURL +  application + '/applicationVersions/' + version + '/artifacts/');
    const artefactStepSize = 200;
    let hasMoreArtefacts = true;
    let allArteFacts = [];
    for (let i = 0; hasMoreArtefacts; i = i + artefactStepSize) {
        // let exportBatch = callURL(cloudURL + 'case/v1/cases?$sandbox=' + getProductionSandbox() + '&$filter=applicationId eq ' + cTypes[curCase].applicationId + typeIdString + '&$top=' + exportCaseStepSize + '&$skip=' + i, 'GET', null, null, false);
        let skip = '';
        if (i != 0) {
            skip = '&$skip=' + i
        }
        const appDet = callURL(getApplicationDetailsURL + application + '/applicationVersions/' + version + '/artifacts/?&$top=' + artefactStepSize + skip, 'GET', null, null, false);
        if (appDet) {
            if (appDet.length < artefactStepSize) {
                hasMoreArtefacts = false;
            }
            allArteFacts = allArteFacts.concat(appDet);
        } else {
            hasMoreArtefacts = false;
        }
        // console.log('Export Artefacts ', appDet);
        // logLine('Getting Artefacts: (' + i + ')...');
    }

    // logO(INFO, appDet);
    var i = 0;
    for (var det in allArteFacts) {
        var appTemp = {};
        appN = i;
        i++;
        appTemp['CLOUD STARTER'] = application;
        appTemp['DETAIL NAME'] = allArteFacts[det].name;
        details[appN] = appTemp;
    }
    // if (doShowTable) console.table(details);
    pexTable(details, 'cloud-starter-details', getPEXConfig(), doShowTable);
    return allArteFacts;
};

//Show all the applications links
showLinks = function () {
    return new Promise(function (resolve, reject) {
        getAppLinks(true);
        resolve();
    });
}

//Get Links to all the applications
getAppLinks = function (showTable) {
    log(INFO, 'Getting Cloud Starter Links...');
    var appLinkTable = {};
    var apps = showAvailableApps(false);
    var i = 1;
    for (let app of apps) {
        var appTemp = {};
        appTemp['APP NAME'] = app.name;
        var appN = i++;
        // appTemp['PUBLISHED VERSION'] = parseInt(app.publishedVersion);
        // console.log(app.name, app.publishedVersion);
        var tempDet = getApplicationDetails(app.name, app.publishedVersion, false);
        logLine("Processing App: (" + appN + '/' + apps.length + ')...');
        //console.log(/[^/]*$/.exec(getProp('Descriptor_File'))[0]);
        if (isIterable(tempDet)) {
            for (let appD of tempDet) {
                //console.log(appD.name);
                // Get file after last slash in Descriptor file name; expected cloudstarter.json
                if (appD.name.includes(/[^/]*$/.exec(getProp('Descriptor_File'))[0])) {
                    //console.log(cloudURL + 'webresource/apps/' + encodeURIComponent(app.name) + '/' + appD.name);
                    const csInfo = callURL(cloudURL + 'webresource/apps/' + encodeURIComponent(app.name) + '/' + appD.name, null, null, null, false);
                    //console.log(csInfo);
                    if (csInfo && csInfo.cloudstarter) {
                        appTemp['CS VERSION'] = csInfo.cloudstarter.version;
                        appTemp['BUILD DATE'] = csInfo.cloudstarter.build_date;
                    }
                }
                if (appD.name.includes("index.html")) {
                    // console.log('FOUND INDEX of ' + app.name + ': ' + appD.name);
                    const tempLink = cloudURL + 'webresource/apps/' + encodeURIComponent(app.name) + '/' + appD.name;
                    // console.log('LOCATION: ' + tempLink);
                    appTemp['LINK'] = tempLink;
                }
            }
        } else {
            if (app.name && tempDet && tempDet.errorMsg) {
                log(ERROR, 'App: ' + app.name + ', Error: ' + tempDet.errorMsg);
            } else {
                log(ERROR, 'Something is wrong with ', app, tempDet);
            }
        }
        appLinkTable[appN] = appTemp;
    }
    process.stdout.write('\n');
    /*
    if (showTable) {
        console.table(appLinkTable);
    }*/
    pexTable(appLinkTable, 'cloud-starter-links', getPEXConfig(), showTable);
    return appLinkTable;
}

isIterable = function (obj) {
    // checks for null and undefined
    if (obj == null) {
        return false;
    }
    return typeof obj[Symbol.iterator] === 'function';
}

// Function to upload a zip to the LiveApps ContentManagment API
uploadApp = function (application) {
    return new Promise(function (resolve, reject) {
        let formData = new require('form-data')();
        log(INFO, 'UPLOADING APP: ' + application);
        var uploadAppLocation = '/webresource/v1/applications/' + application + '/upload/';
        //formData.append('key1', 1);
        // formData.setHeader("cookie", "tsc="+lCookie.tsc + "; domain=" + lCookie.domain);
        formData.append('appContents', require("fs").createReadStream('./dist/' + application + '.zip'));
        const header = {};
        header['Content-Type'] = 'multipart/form-data; charset=UTF-8';
        // Possibly add OAUTH Header...
        if (isOauthUsed()) {
            header["Authorization"] = 'Bearer ' + getProp('CloudLogin.OAUTH_Token');
        } else {
            var lCookie = cLogin();
            header["cookie"] = "tsc=" + lCookie.tsc + "; domain=" + lCookie.domain;
        }

        let query = require('https').request({
            hostname: cloudHost,
            path: uploadAppLocation,
            method: 'POST',
            headers: header /*{
                "cookie": "tsc=" + lCookie.tsc + "; domain=" + lCookie.domain,
                'Content-Type': 'multipart/form-data; charset=UTF-8'
            },*/
        }, (res) => {
            let data = '';
            res.on("data", (chunk) => {
                data += chunk.toString('utf8');
            });
            res.on('end', () => {
                console.log(data);
                resolve();
            })
        });

        query.on("error", (e) => {
            console.error(e);
            resolve();
        });

        formData.pipe(query);

    });
}

// Function to publish the application to the cloud
publishApp = function (application) {
    return new Promise(function (resolve, reject) {
        // var lCookie = cLogin();
        // var lCookie = cloudLoginV3();
        // console.log('Login Cookie: ' , lCookie);
        var publishLocation = cloudURL + 'webresource/v1/applications/' + application + '/';
        /*
        var response = syncClient.put(publishLocation, {
            headers: {
                "accept": "application/json",
                "cookie": "tsc=" + lCookie.tsc + "; domain=" + lCookie.domain
            }
        });*/
        var response = callURL(publishLocation, 'PUT');
        log(INFO, 'Publish Result: ', response);
        resolve();
    });
}

// Function to call the Tibco Cloud
callURL = function (url, method, postRequest, contentType, doLog, tenant, customLoginURL, returnResponse, forceOAUTH, forceCLIENTID) {
    const fOAUTH = forceOAUTH || false;
    const fCLIENTID = forceCLIENTID || false;
    const reResponse = returnResponse || false;
    let lCookie = {};
    if (!fOAUTH) {
        lCookie = cLogin(tenant, customLoginURL);
    }
    if (fCLIENTID) {
        lCookie = cLogin(tenant, customLoginURL, true);
    }
    const cMethod = method || 'GET';
    let cdoLog = false;
    if (doLog != null) {
        cdoLog = doLog;
    }
    const cType = contentType || 'application/json';
    let body = null;
    if (cMethod.toLowerCase() != 'get') {
        if (cType === 'application/json') {
            body = JSON.stringify(postRequest);
        } else {
            body = postRequest;
        }
    }

    const header = {};
    header["accept"] = 'application/json';
    header["Content-Type"] = cType;
    // Check if we need to provide the OAUTH token
    if ((isOauthUsed() && isOAUTHValid) || fOAUTH) {
        header["Authorization"] = 'Bearer ' + getProp('CloudLogin.OAUTH_Token');
    } else {
        header["cookie"] = "tsc=" + lCookie.tsc + "; domain=" + lCookie.domain;
    }
    if (fCLIENTID) {
        header["cookie"] = "tsc=" + lCookie.tsc + "; domain=" + lCookie.domain;
        delete header.Authorization;
    }

    if (cdoLog) {
        log(INFO, '--- CALLING SERVICE ---');
        log(INFO, '- URL(' + cMethod + '): ' + url);
        log(DEBUG, '-  METHOD: ' + cMethod);
        log(DEBUG, '- CONTENT: ' + cType);
        log(DEBUG, '-  HEADER: ', header);
    }
    if (!(cMethod.toLowerCase() == 'get' || cMethod.toLowerCase() == 'del')) {
        if (cdoLog) {
            log(INFO, '-    BODY: ' + body);
        }
    }

    let response = {};
    if (cMethod.toLowerCase() === 'get') {
        response = syncClient[cMethod.toLowerCase()](encodeURI(url), {
            headers: header
        });
    } else {
        response = syncClient[cMethod.toLowerCase()](encodeURI(url), {
            headers: header,
            payload: body
        });
    }
    if (response.body.errorMsg != null) {
        log(ERROR, response.body.errorMsg);
        log(ERROR, response.body);
        return null;
    } else {
        if (reResponse) {
            return response;
        }
        return response.body;
    }
}

let globalProductionSandbox = null;
getProductionSandbox = function () {
    if (!globalProductionSandbox) {
        const claims = callURL(getClaimsURL);
        for (let sb of claims.sandboxes) {
            if (sb.type === 'Production') {
                globalProductionSandbox = sb.id;
            }
        }
        log(INFO, 'SANDBOX ID: ' + globalProductionSandbox);
    }
    return globalProductionSandbox;
}


const getTypesURL = cloudURL + 'case/v1/types'; // getProp('Claims_URE');
// Function to
showLiveApps = function (doShowTable, doCountCases) {
    // https://eu.liveapps.cloud.tibco.com/case/v1/types?%24sandbox=31

    //TODO: Call can be optimized by only requesting the basics
    const caseTypes = callURL(getTypesURL + '?$sandbox=' + getProductionSandbox() + '&$top=1000');
    log(DEBUG, 'Case Types: ', caseTypes)

    // TODO: (maybe) get case owner

    var cases = {};
    for (var curCase in caseTypes) {
        var caseTemp = {};
        var appN = parseInt(curCase) + 1;
        //log(INFO, appN + ') APP NAME: ' + response.body[app].name  + ' Published Version: ' +  response.body[app].publishedVersion + ' (Latest:' + response.body[app].publishedVersion + ')') ;
        caseTemp['CASE NAME'] = caseTypes[curCase].name;
        caseTemp['APPLICATION ID'] = caseTypes[curCase].applicationId;
        caseTemp['VERSION'] = caseTypes[curCase].applicationVersion;
        caseTemp['IS CASE'] = caseTypes[curCase].isCase;
        if (doCountCases) {
            logLine("Counting Cases: (" + appN + '/' + caseTypes.length + ')...');
            caseTemp['NUMBER OF CASES'] = callURL(cloudURL + 'case/v1/cases?$sandbox=' + getProductionSandbox() + '&$filter=applicationId eq ' + caseTypes[curCase].applicationId + '&$count=true', 'GET', null, null, false);
        }

        //https://eu.liveapps.cloud.tibco.com/?%24sandbox=31&%24filter=applicationId%20eq%202880&%24count=true
        cases[appN] = caseTemp;

    }
    console.log('\n');
    //logO(INFO,apps);
    // if (doShowTable) console.table(cases);
    pexTable(cases, 'live-apps', getPEXConfig(), doShowTable);

    return caseTypes;


}

// Shared state folder (picked up from configuration if exists)
let CASE_FOLDER = './Cases/';
if (getProp('Case_Folder') != null) {
    CASE_FOLDER = getProp('Case_Folder');
} else {
    addOrUpdateProperty(getPropFileName(), 'Case_Folder', CASE_FOLDER);
}

/*
getCaseType = async function(question){
    const cTypes = showLiveApps(true, false);
    let cTypeArray = new Array();
    for (var curCase in cTypes) {
        cTypeArray.push(cTypes[curCase].name);
    }
    let choosenCT = await askMultipleChoiceQuestionSearch(question, cTypeArray);
    let re = { 'choosenCT' : choosenCT,
        'cTypes' : cTypes };
    return re;
}*/

const storeOptions = {spaces: 2, EOL: '\r\n'};
exportLiveAppsCaseType = async function () {
    const cTypes = showLiveApps(true, false);
    let cTypeArray = new Array();
    for (var curCase in cTypes) {
        cTypeArray.push(cTypes[curCase].name);
    }
    let typeForExport = await askMultipleChoiceQuestionSearch('Which Case-Type would you like to export ?', cTypeArray);
    let fName = await askQuestion('What file name would you like to export to ? (press enter for default)');
    for (var curCase in cTypes) {
        if (typeForExport == cTypes[curCase].name) {

            mkdirIfNotExist(CASE_FOLDER);
            let fileName = CASE_FOLDER + fName;
            if (fName == '') {
                fileName = CASE_FOLDER + cTypes[curCase].name + '.' + cTypes[curCase].applicationVersion + '.type.json';
            }
            jsonfile.writeFileSync(fileName, cTypes[curCase], storeOptions);
            log(INFO, 'Case Type File Stored: ' + fileName)
        }
        ;
    }
}

const exportCaseStepSize = 30;
// Function to export case data
exportLiveAppsData = async function () {
    const cTypes = showLiveApps(true, true);
    let cTypeArray = new Array();
    for (var curCase in cTypes) {
        cTypeArray.push(cTypes[curCase].name);
    }
    let typeForExport = await askMultipleChoiceQuestionSearch('Which Case-Type would you like to export ?', cTypeArray);
    let fName = await askQuestion('What Folder like to export to ? (press enter for default, date get\'s added...)');
    // let oneFileStore = await askMultipleChoiceQuestion('Do you also want to store all contents in one file ? (this is used for import)', ['YES', 'NO']);
    let allCases = new Array();
    for (let curCase in cTypeArray) {
        if (cTypeArray[curCase] == typeForExport) {
            // count cases
            const numberOfCasesForExport = callURL(cloudURL + 'case/v1/cases?$sandbox=' + getProductionSandbox() + '&$filter=applicationId eq ' + cTypes[curCase].applicationId + '&$count=true', 'GET', null, null, false);
            log(INFO, 'Number of cases for export: ' + numberOfCasesForExport);
            const typeIdString = ' and typeId eq 1';
            // get cases in batch sizes
            for (let i = 0; i <= numberOfCasesForExport; i = i + exportCaseStepSize) {
                let exportBatch = callURL(cloudURL + 'case/v1/cases?$sandbox=' + getProductionSandbox() + '&$filter=applicationId eq ' + cTypes[curCase].applicationId + typeIdString + '&$top=' + exportCaseStepSize + '&$skip=' + i, 'GET', null, null, false);
                // console.log('Export Batch', exportBatch);
                logLine('Exporting Case: (' + i + '/' + numberOfCasesForExport + ')...');
                allCases = allCases.concat(exportBatch);
            }
            log(INFO, 'Number of Exported Cases: ' + allCases.length);
            // Write Cases
            let cfName = CASE_FOLDER + fName;
            if (fName == '') {
                //Add date to the end of this
                const today = new Date();
                const dayAddition = '(' + today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate() + '_h' + today.getHours() + 'm' + today.getMinutes() + ')';
                cfName = CASE_FOLDER + 'Export-' + typeForExport + dayAddition + '/';
            }
            mkdirIfNotExist(cfName);
            mkdirIfNotExist(cfName + 'CONTENT/');
            let AllCaseArray = [];
            for (let exCase of allCases) {
                let contextFileName = cfName + typeForExport + '-' + exCase.caseReference + '.json';
                let writeContentSeparate = false;
                let contentObject = {};
                //let contextFileName = CASE_FOLDER + sSEntry.name + '.json';
                let contentFileName = cfName + 'CONTENT/' + typeForExport + '-' + exCase.caseReference + '.CONTENT.json';
                if (exCase.casedata != null) {
                    try {
                        // Get the details for every shared state entry
                        contentObject = JSON.parse(' {  "' + cTypes[curCase].name + '" : ' + exCase.casedata + '}');
                        AllCaseArray.push(contentObject);
                        exCase.casedata = {'FILESTORE': contentFileName};
                        // And store them in a file / folder
                        jsonfile.writeFileSync(contentFileName, contentObject, storeOptions);
                        writeContentSeparate = true;
                        //log(INFO, '[STORED CONTENT]: ' + contentFileName);
                    } catch (e) {
                        log(ERROR, 'Parse Error on: ' + exCase.name + 'Writing directly...');
                    }
                    jsonfile.writeFileSync(contextFileName, exCase, storeOptions);
                    // log(INFO, 'Exported Case To: ' + cfName);
                    log(INFO, '[STORED CONTEXT]: ' + contextFileName);
                    if (writeContentSeparate) {
                        log(INFO, '[STORED CONTENT]: ' + contentFileName);
                    } else {
                        log(ERROR, 'Stored all in: ' + contextFileName);
                    }
                }
            }
            //if(oneFileStore == 'YES'){
            let AllCaseFileName = cfName + 'CONTENT/' + typeForExport + '-ALL.CONTENT.json';
            //TODO: Put the app name around the AllCaseArray

            jsonfile.writeFileSync(AllCaseFileName, AllCaseArray, storeOptions);
            log(INFO, '[STORED ALL CONTENT]: ' + AllCaseFileName);
            //}
        }
    }
}

//DONE: Add Export Feature to one file. (Just the data and to use for import)

createLAImportFile = async function () {
    log(INFO, ' -- Generate Live Aps Import Configuration file --- ');
    //TODO: Create a generator for the input feature. (based on the template and ask to add steps)
    //TODO: Make sure you are not overwriting a current import file.
    // Check if default file exists:
    const importFolder = process.cwd() + '/' + CASE_FOLDER + 'Import/';
    let impConfFileName = 'import-live-apps-data-configuration.json';
    let nameAnsw = await askQuestion('Please specify a name for the Live Apps Import Config file (\x1b[34mDefault: import-live-apps-data-configuration\033[0m) ?');
    if (nameAnsw != null && nameAnsw != '') {
        impConfFileName = nameAnsw + '.properties';
    }
    const targetFile = importFolder + impConfFileName;
    let doWrite = true;
    if (doesFileExist(targetFile)) {
        const doOverWrite = await askMultipleChoiceQuestion('The property file: \x1b[34m' + impConfFileName + '\033[0m already exists, do you want to Overwrite it ?', ['YES', 'NO']);
        if (doOverWrite == 'NO') {
            doWrite = false;
            log(INFO, 'OK, I won\'t do anything :-)');
        }
    }
    if (doWrite) {
        mkdirIfNotExist(CASE_FOLDER);
        mkdirIfNotExist(importFolder);
        log(INFO, 'Creating new Live Aps Import Configuration file: ' + impConfFileName);
        copyFile(__dirname + '/../template/import-live-apps-data-configuration.json', targetFile);
        // log(INFO, 'Now configure the multiple propety file and then run "\x1b[34mtcli -m\033[0m" (for default propety name) or "\x1b[34mtcli -m <propfile name>\033[0m" to execute...');
    }
}

// Function to Import LiveApps Case Data based on Config File
importLiveAppsData = async function () {
    log(INFO, ' -- Gathering Import Configuration --- ');
    const importFolder = process.cwd() + '/' + CASE_FOLDER + 'Import/';
    let importFile = importFolder + 'import-live-apps-data-configuration.json';
    //TODO: Choose import file (if there are more) --> Starts with import && ends with json

    // If default import file does not exist, ask for a custom one.
    if (!doesFileExist(importFile)) {
        importFile = process.cwd() + '/' + await askQuestion('Default Import file (' + importFile + ') not found, which import configuration file would you like to use ?');
    }
    const impConf = require(importFile);
    const cSteps = impConf['import-steps'];
    log(INFO, 'Configured Steps: ', cSteps);

    //TODO: check if data of all steps has the same size
    //TODO: Check if there is a creator (how to map the caseID)
    //TODO: Check if the first step is a creator

    //Loop over all the data
    if (impConf[impConf[impConf['import-steps'][0]].data].FILESTORE != null) {
        dataForImport = jsonfile.readFileSync(importFolder + impConf[impConf[impConf['import-steps'][0]].data].FILESTORE)
    } else {
        dataForImport = impConf[impConf['import-steps'][0]].data;
    }
    const numberOfImports = dataForImport.length;

    const sBid = getProductionSandbox();
    let importAppName = '';
    let importAppId = '';
    let numberOfImportSteps = 0;
    if (impConf['la-application-name'] != null) {
        importAppName = impConf['la-application-name'];
        log(INFO, 'Getting App Id for LA Application ' + importAppName);
        const apps = showLiveApps(false, false);
        //console.log(apps);
        let appData = {};
        for (let app of apps) {
            if (app.name == importAppName) {
                importAppId = app.applicationId;
                appData = app;
            }
        }
        numberOfImportSteps = impConf['import-steps'].length;
        for (let step of impConf['import-steps']) {
            const stepConf = impConf[step];
            //console.log(stepConf)
            impConf[step].applicationId = importAppId;
            if (stepConf.type == 'CREATOR') {
                // Look in the creators
                if (appData.creators != null) {
                    for (let creator of appData.creators) {
                        if (creator.name == stepConf.name) {
                            impConf[step]['process-id'] = creator.id;
                        }
                    }
                }
            }
            if (stepConf.type == 'ACTION') {
                // Look in the creators
                if (appData.actions != null) {
                    for (let action of appData.actions) {
                        if (action.name == stepConf.name) {
                            impConf[step]['process-id'] = action.id;
                        }
                    }
                }
            }
        }

    }
    // console.log(impConf);
    showCloudInfo();
    log(INFO, '\x1b[34m                   -- IMPORT SUMMARY --- ');
    log(INFO, '\x1b[34m -       Number of Imports: ' + numberOfImports);
    log(INFO, '\x1b[34m -              Sandbox ID: ' + sBid);
    log(INFO, '\x1b[34m -         Import App Name: ' + importAppName);
    log(INFO, '\x1b[34m -           Import App ID: ' + importAppId);
    log(INFO, '\x1b[34m -  Number of Import Steps: ' + numberOfImportSteps);
    let stepN = 1;
    //Show Summary Table (Step Number, Step Name, SandboxID, Application Name, Application ID, Process Type, Process Name, Process ID, Sleep Time)

    for (let step of impConf['import-steps']) {
        const stepConf = impConf[step];
        log(INFO, '\x1b[33m -                    STEP: ' + stepN);
        log(INFO, '\x1b[34m -                    NAME: ' + stepConf.name);
        log(INFO, '\x1b[34m -                    TYPE: ' + stepConf.type);
        log(INFO, '\x1b[34m -              PROCESS ID: ' + stepConf['process-id']);
        log(INFO, '\x1b[34m -              SLEEP TIME: ' + stepConf['sleep']);
        stepN++;
    }

    log(INFO, '\033[0m');


    let runImport = true;
    const doOverWrite = await askMultipleChoiceQuestion('ARE YOU SURE YOU WANT TO START THE IMPORT ?', ['YES', 'NO']);
    if (doOverWrite == 'NO') {
        runImport = false;
        log(INFO, 'OK, I won\'t do anything :-)');
    }


    if (runImport) {
        for (let i = 0; i < numberOfImports; i++) {
            //Loop over all cases
            let caseRef = '';
            for (let impStep of impConf['import-steps']) {
                const stepConf = impConf[impStep];
                // TODO: Add option to provide process name and type and then look up the application ID an process ID
                log(INFO, '           Step: ' + impStep);
                log(INFO, '     Process ID: ' + stepConf['process-id']);
                log(INFO, ' Application ID: ' + stepConf.applicationId);
                //Option to point to file for importing data
                let dataForImport = [];
                //TODO: put this in seperate function
                if (impConf[stepConf.data].FILESTORE != null) {
                    // console.log(impConf[stepConf.data].FILESTORE);
                    dataForImport = jsonfile.readFileSync(importFolder + impConf[stepConf.data].FILESTORE)
                } else {
                    dataForImport = impConf[stepConf.data];
                }
                const dataToImport = dataForImport[i];
                if (stepConf.type.toString().toLowerCase() == 'creator') {
                    log(INFO, 'Creating LiveApps Case (' + i + ')');
                    let postRequest = {
                        id: stepConf['process-id'],
                        sandboxId: sBid,
                        applicationId: stepConf.applicationId,
                        data: JSON.stringify(dataToImport)
                    }
                    //console.log(postRequest);
                    const response = callURL(cloudURL + 'process/v1/processes', 'POST', postRequest, null, true);
                    log(INFO, 'Response: ', response);
                    //Get Case ID
                    caseRef = response.caseReference;
                }
                /* TODO: TEST this... */
                if (stepConf.type.toString().toLowerCase() == 'action') {
                    if (stepConf.caseref) {
                        if (stepConf.caseref.toString().toLowerCase() == 'from-creator') {
                            if (caseRef == '') {
                                log(ERROR, 'Caseref to be configured from creator but no caseref is set...');
                            }
                        } else {
                            const _F = require('lodash');
                            caseRef = _F.get(dataToImport, stepConf.caseref);
                            log(INFO, 'Using CaseRef: ' + caseRef);
                            if (stepConf['delete-caseref'].toLowerCase() == 'true') {
                                _F.unset(dataToImport, stepConf.caseref);
                            }
                        }
                    }
                    //console.log('Data to Import:', dataToImport);
                    log(INFO, 'Actioning LiveApps Case (' + i + ') Ref ' + caseRef);
                    let postRequest = {
                        id: stepConf['process-id'],
                        sandboxId: sBid,
                        applicationId: stepConf.applicationId,
                        /*TODO: look at bug .replace is not a function */
                        data: JSON.stringify(dataToImport).replace('@@CASEREF@@', caseRef),
                        caseReference: caseRef
                    }
                    const response = callURL(cloudURL + 'process/v1/processes', 'POST', postRequest, null, true);
                    // log(INFO, 'Response: ' , response);

                }
                if (stepConf.sleep && stepConf.sleep > 0) {
                    log(INFO, 'Sleeping for ' + stepConf.sleep + ' ms...');
                    await sleep(stepConf.sleep);
                }
            }
        }
    }
}

// Function to
csvToJsonLiveAppsData = function () {

}

// Function to
jsonToCsvLiveAppsData = function () {

}


// Get the TIBCO Cloud Starter Development Kit from GIT
getGit = function (source, target, tag) {
    const git = require('gulp-git');
    log(INFO, 'Getting GIT) Source: ' + source + ' Target: ' + target + ' Tag: ' + tag);
    // git clone --branch bp-baseV1 https://github.com/TIBCOSoftware/TCSDK-Angular
    if (tag == 'LATEST') {
        return git.clone(source, {args: target}, function (err) {
        });
    } else {
        return git.clone(source, {args: '--branch ' + tag + ' ' + target}, function (err) {
        });
    }
}

// Function to install NPM packages
npmInstall = function (location, package) {
    return new Promise(function (resolve, reject) {
        if (package != null) {
            run('cd ' + location + ' && npm install ' + package);
        } else {
            run('cd ' + location + ' && npm install');
        }
        resolve();
    });
}

// Function to test features
testFunction = async function (propFile) {
    var re = await askMultipleChoiceQuestionSearch('Which Region would you like to use ? ', ['US - Oregon', 'EU - Ireland', 'AU - Sydney']);
    return re;
}

// Function to copy a directory
copyDir = function (fromDir, toDir) {
    const fse = require('fs-extra');
    log(INFO, 'Copying Directory from: ' + fromDir + ' to: ' + toDir);
    fse.copySync(fromDir, toDir, {overwrite: true});
}

// Function to delete a file but does not fail when the file does not exits
deleteFile = function (file) {
    log(INFO, 'Deleting File: ' + file);
    try {
        fs.unlinkSync(file);
        //file removed
    } catch (err) {
        log(INFO, 'Could not delete file, maybe file does not exist ?... (' + err.code + ')');
        //console.log(err)
    }
}


checkPW = function () {
    if (getProp('CloudLogin.pass') == null || getProp('CloudLogin.pass') == '') {
        log(ERROR, 'Please provide your password to login to the tibco cloud in the file tibco-cloud.properties (for property: CloudLogin.pass)');
        process.exit();
    }
}

//var readline = require('readline');
//var Writable = require('stream').Writable;

// Use WSU to generate TCI code
wsuAddTci = function () {
    return new Promise(async function (resolve, reject) {
        // TODO: Implement
        console.log('TODO: Implement');
        resolve();
    });
}

wsuListTci = function () {
    return new Promise(async function (resolve, reject) {
        // TODO: Remove web scaffolding utility ?
        /*var wsu = require('@tibco-tcstk/web-scaffolding-utility');
        console.log(wsu.API.getVersion());
        wsu.API.login(getProp('CloudLogin.clientID'), getProp('CloudLogin.email'), getProp('CloudLogin.pass'));
        // console.log(wsu.API.getArtefactList("TCI").createTable());
        var afList = wsu.API.getArtefactList(wsu.API.flavour.TCI);
        console.table(afList.createTable());
        */
        resolve();

    });
}

const posSchematics = require('../config-schematics').schematicConfig;
schematicAdd = function () {
    return new Promise(async function (resolve, reject) {
        log(INFO, 'Adding Schematic...');
        const LIST_ALL = 'List All Possible Schematics';
        // Check if schematic is allowed
        let listing = true;
        let initialList = true;
        let sType = '';
        while (listing) {
            const appType = getProp('App_Type');
            let possibleSchematics = posSchematics.descriptions;
            let question = 'What type of schematic would you like to add ?';
            if (appType != null && initialList) {
                possibleSchematics = [LIST_ALL];
                for (let sNr in posSchematics.AvailableInTemplate) {
                    for (let availableSchematic of posSchematics.AvailableInTemplate[sNr]) {
                        // console.log('App Type: ', appType, ' availableSchematic: ', availableSchematic);
                        if (appType == availableSchematic) {
                            possibleSchematics.unshift(posSchematics.descriptions[sNr]);
                        }
                    }
                }
                question = 'Based on your application type ' + colors.blue(appType) + ' you can choose one of the following schematics (or choose list all):'
                initialList = false;
            }
            sType = await askMultipleChoiceQuestion(question, possibleSchematics);
            if (sType != LIST_ALL) {
                listing = false;
            }
        }
        const sName = await askQuestion('What is the name of your schematic ?');
        run('ng generate @tibco-tcstk/component-template:' + posSchematics.names[posSchematics.descriptions.indexOf(sType)] + ' ' + sName);
        // Run npm install only after certain schematics.
        log(INFO, 'DO RUN NPM: ' + posSchematics.doRunNPM[posSchematics.descriptions.indexOf(sType)]);
        if (posSchematics.doRunNPM[posSchematics.descriptions.indexOf(sType)]) {
            run('npm install');
        }
        resolve();
    });
}

//var art = require('ascii-art');
//https://www.npmjs.com/package/ascii-art-font
// Show TCI Apps
showTCI = function (showTable) {
    let doShowTable = true;
    if (showTable != null) {
        doShowTable = showTable;
    }
    log(INFO, 'Getting TCI Apps...');
    const loginEndpoint = 'https://' + getCurrentRegion(true) + 'integration.cloud.tibco.com/idm/v3/login-oauth';
    const appEndpoint = 'https://' + getCurrentRegion() + 'integration.cloud.tibco.com/api/v1/apps';
    const response = callURL(appEndpoint, 'GET', null, null, false, 'TCI', loginEndpoint, null, false, true);
    let tObject = createTable(response, mappings.tci_apps, false);
    pexTable(tObject, 'tci-apps', getPEXConfig(), doShowTable);
    log(DEBUG, 'TCI Object: ', tObject);
    return tObject;
}

monitorTCI = async function () {
    log(INFO, 'Monitoring a TCI App');
    // showCloudInfo(false);
    const tibCli = getTIBCli();
    const tciApps = showTCI();
    let tAppsToChoose = ['Nothing'];
    for (let tApp of iterateTable(tciApps)) {
        // console.log(tApp);
        if (tApp && tApp.Name) {
            tAppsToChoose.push(tApp.Name);
        }

    }
    let appToMonitor = await askMultipleChoiceQuestionSearch('Which TCI App would you like to monitor ?', tAppsToChoose);
    if (appToMonitor != 'Nothing') {
        // console.log(appToMonitor);
        // run(tibCli + ' logout');
        // TODO: move this logic to common lib
        let email = getProp('CloudLogin.email');
        var pass = getProp('CloudLogin.pass');
        if (pass == 'USE-GLOBAL') pass = propsG.CloudLogin.pass;
        if (email == 'USE-GLOBAL') email = propsG.CloudLogin.email;
        if (pass == '') {
            pass = argv.pass;
            // console.log('Pass from args: ' + pass);
        }
        if (pass.charAt(0) == '#') {
            pass = Buffer.from(pass, 'base64').toString()
        }
        pass = pass.replace('$', '\\$')

        run(tibCli + ' login -u "' + email + '" -p "' + pass + '" -o "' + getOrganization() + '" -r "' + getCurrentAWSRegion() + '"');
        log(INFO, 'Monitoring ' + colors.yellow('[' + appToMonitor + ']') + ' in organization ' + colors.blue('[' + getOrganization() + ']'))
        run(tibCli + ' monitor applog -s ' + appToMonitor);
    } else {
        log(INFO, 'OK, I won\'t do anything :-)');
    }
}

// Function to generate other property files next to the existing ones
generateCloudPropertyFiles = async function () {
    log(INFO, 'Generating Cloud Property Files');
    const response = callURL('https://' + getCurrentRegion() + clURI.account_info, null, null, null, false, 'TSC', 'https://' + getCurrentRegion() + clURI.general_login);
    // console.log(response);
    let projectName = await askQuestion('What is the name of your Project ? (press enter to leave it blank)');
    if (projectName.trim() != '') {
        projectName = projectName + '_';
    }
    const propFilesALL = [];
    const propFilesEU = [];
    const propFilesUS = [];
    const propFilesAU = [];
    const propOption = ['NONE', 'ALL', 'ALL EU', 'ALL US', 'ALL AU'];
    for (let org of response.accountsInfo) {
        let orgName = '' + org.accountDisplayName;
        let tOrgName = orgName.replace(/ /g, '_').replace(/'/g, '_').replace(/-/g, '_').replace(/_+/g, '_');
        let tOrgNameEU = {
            REGION: 'EU',
            PROPERTY_FILE_NAME: 'tibco-cloud-' + projectName + 'EU_' + tOrgName + '.properties',
            PROP: 'tibco-cloud-' + projectName + 'EU_' + tOrgName
        };
        let tOrgNameUS = {
            REGION: 'US',
            PROPERTY_FILE_NAME: 'tibco-cloud-' + projectName + 'US_' + tOrgName + '.properties',
            PROP: 'tibco-cloud-' + projectName + 'US_' + tOrgName
        };
        let tOrgNameAU = {
            REGION: 'AU',
            PROPERTY_FILE_NAME: 'tibco-cloud-' + projectName + 'AU_' + tOrgName + '.properties',
            PROP: 'tibco-cloud-' + projectName + 'AU_' + tOrgName
        };
        propOption.push(tOrgNameEU.PROPERTY_FILE_NAME, tOrgNameUS.PROPERTY_FILE_NAME, tOrgNameAU.PROPERTY_FILE_NAME);
        propFilesALL.push(tOrgNameEU, tOrgNameUS, tOrgNameAU);
        propFilesEU.push(tOrgNameEU);
        propFilesUS.push(tOrgNameUS);
        propFilesAU.push(tOrgNameAU);
    }
    log(INFO, 'Files that can be created');
    console.table(propFilesALL);
    let propFilesToGenerate = await askMultipleChoiceQuestionSearch('Which property file(s) would you like to generate ?', propOption);
    let propForMFile = '';
    if (propFilesToGenerate != 'NONE') {
        let genOne = true;
        if (propFilesToGenerate == 'ALL' || propFilesToGenerate == 'ALL EU') {
            genOne = false;
            for (let pFile of propFilesEU) {
                configurePropFile('./' + pFile.PROPERTY_FILE_NAME, pFile.REGION);
                propForMFile += pFile.PROP + ',';
            }
        }
        if (propFilesToGenerate == 'ALL' || propFilesToGenerate == 'ALL US') {
            genOne = false;
            for (let pFile of propFilesUS) {
                configurePropFile('./' + pFile.PROPERTY_FILE_NAME, pFile.REGION);
                propForMFile += pFile.PROP + ',';
            }
        }
        if (propFilesToGenerate == 'ALL' || propFilesToGenerate == 'ALL AU') {
            genOne = false;
            for (let pFile of propFilesAU) {
                configurePropFile('./' + pFile.PROPERTY_FILE_NAME, pFile.REGION);
                propForMFile += pFile.PROP + ',';
            }
        }
        if (genOne) {
            let reg = '';
            for (let pFile of propFilesALL) {
                if (pFile.PROPERTY_FILE_NAME == propFilesToGenerate) {
                    reg = pFile.REGION;
                    propForMFile += pFile.PROP + ',';
                }
            }
            configurePropFile('./' + propFilesToGenerate, reg);
        }
        const tcliIprop = propForMFile.substr(0, propForMFile.length - 1);
        log(INFO, 'Property for tcli interaction: ' + tcliIprop);
        const doUpdate = await askMultipleChoiceQuestion('Do you want to add this to your manage-multiple-cloud-starters property file ?', ['YES', 'NO']);
        if (doUpdate == 'YES') {
            let fileName = await askQuestion('What is file name of multiple property file ? (press enter for: manage-multiple-cloud-starters.properties)');
            if (fileName == '') {
                fileName = 'manage-multiple-cloud-starters.properties';
            }
            addOrUpdateProperty(fileName, 'Multiple_Interaction_Property_Files', tcliIprop);
        } else {
            log(INFO, 'OK, I won\'t do anything :-)');
        }
    } else {
        log(INFO, 'OK, I won\'t do anything :-)');
    }
}

configurePropFile = function (fileName, region) {
    log(INFO, '[' + region + ']: Generating: ' + fileName);
    let regToAdd = '';
    if (region == 'EU') {
        regToAdd = 'eu.';
    }
    if (region == 'AU') {
        regToAdd = 'au.';
    }
    copyFile(getPropFileName(), fileName);
    addOrUpdateProperty(fileName, 'CloudLogin.clientID', "<PLEASE GET THE API access key(CLIENT ID) FROM: https://" + regToAdd + "account.cloud.tibco.com/manage/settings/oAuthTokens>");
    addOrUpdateProperty(fileName, 'cloudHost', regToAdd + 'liveapps.cloud.tibco.com');
    addOrUpdateProperty(fileName, 'Cloud_URL', 'https://' + regToAdd + 'liveapps.cloud.tibco.com/');
    log(WARNING, 'Remember to Update The Client ID in: ' + fileName);

}


// Function to display all OAUTH Tokens...
showOauthToken = function () {
    log(INFO, 'Displaying OAUTH Tokens...');
    let getOauthUrl = 'https://' + getCurrentRegion() + clURI.get_oauth;
    const response = callURL(getOauthUrl, 'GET', null, null, false, 'TSC', 'https://' + getCurrentRegion() + clURI.general_login);
    // console.log(response);
    for (let rep in response) {
        if (response[rep]['lastAccessed']) {
            response[rep]['used'] = 'IN USE';
            response[rep]['lastAccessed'] = response[rep]['lastAccessed'] * 1000;
        } else {
            response[rep]['used'] = 'NEVER USED';
        }
        // Times need to be multiplied by 1000 (probalby UNIX Time)
        response[rep]['generatedTime'] = response[rep]['generatedTime'] * 1000;
        response[rep]['expirationTime'] = response[rep]['expirationTime'] * 1000;
    }
    const tObject = createTable(response, mappings.oauth, true);
    log(DEBUG, 'OAUTH Object: ', tObject);
    return tObject;
}

// Function to revoke an OAUTH Token
revokeOauthToken = function (tokenName) {
    return new Promise(async function (resolve, reject) {
        if (!tokenName) {
            //No token name provided so choose on from list
            const possibleTokensArrObj = showOauthToken();
            let possibleTokens = ['NO TOKEN'];
            for (let tok of iterateTable(possibleTokensArrObj)) {
                possibleTokens = possibleTokens.filter(f => f != tok.Name).concat([tok.Name])
            }
            // console.log(possibleTokens);
            tokenName = await askMultipleChoiceQuestion('Which token would you like to revoke ?', possibleTokens);
        }
        if (tokenName != 'NO TOKEN') {
            log(INFO, 'Revoking OAUTH Token:  ' + tokenName);
            let revokeOauthUrl = 'https://' + getCurrentRegion() + clURI.revoke_oauth;
            const postRequest = 'name=' + tokenName;
            const response = callURL(revokeOauthUrl, 'POST', postRequest, 'application/x-www-form-urlencoded', false, 'TSC', 'https://' + getCurrentRegion() + clURI.general_login);
            log(INFO, 'Result: ', colors.blue(response.message));
        } else {
            log(INFO, 'OK, I won\'t do anything :-)');
        }
        resolve();
    });
}

// Function to rotate an OAUTH Token
rotateOauthToken = function () {
    return new Promise(async function (resolve, reject) {
        if (getProp('CloudLogin.OAUTH_Generate_Token_Name') != null) {
            const tokenName = getProp('CloudLogin.OAUTH_Generate_Token_Name');

            const tokenNumber = Number(tokenName.split('_').pop().trim());
            let newTokenNumber = 0;
            let newTokenName = '';
            let doRotate = false;
            //console.log('Token Number: |' + tokenNumber + '|');
            if (!isNaN(tokenNumber)) {
                newTokenNumber = tokenNumber + 1;
                newTokenName = tokenName.replace(tokenNumber, newTokenNumber);
                doRotate = true;
            } else {
                log(ERROR, 'For token rotation use this pattern: <TOKEN NAME>_<TOKEN NUMBER> (For example: MyToken_1)')
            }
            //console.log('New Token Number: ' , newTokenNumber);
            // console.log('New Token Name: ' , newTokenName);
            if (doRotate) {
                log(INFO, 'Rotating OAUTH Token:  ' + tokenName);
                log(INFO, '     New OAUTH Token:  ' + newTokenName);
                // Generate new Token
                generateOauthToken(newTokenName, true);
                // Update token name
                addOrUpdateProperty(getPropFileName(), 'CloudLogin.OAUTH_Generate_Token_Name', newTokenName);
                // Revoke old token
                revokeOauthToken(tokenName);
                log(INFO, 'Successfully Rotated Token: ' + tokenName + ' --> ' + newTokenName);

            }
        } else {
            log(ERROR, 'No CloudLogin.OAUTH_Generate_Token_Name Property found (Perhaps you want to run generate-oauth-token first...)')
        }
        resolve();
    });
}

validateAndRotateOauthToken = async function (isInteractive) {
    let doInteraction = true;
    if (isInteractive != null) {
        doInteraction = isInteractive;
    }
    log(INFO, 'Validating and Rotating OAUTH Token...');
    // Ask for prop to force the parsing
    const oKey = getProp('CloudLogin.OAUTH_Token');
    let oauth_required_hours_valid = 168;
    if (getProp('CloudLogin.OAUTH_Required_Hours_Valid') != null) {
        oauth_required_hours_valid = getProp('CloudLogin.OAUTH_Required_Hours_Valid');
    } else {
        log(INFO, 'No CloudLogin.OAUTH_Required_Hours_Valid property found; We are adding it to: ' + getPropFileName());
        addOrUpdateProperty(getPropFileName(), 'CloudLogin.OAUTH_Required_Hours_Valid', oauth_required_hours_valid, 'Number of hours that the OAUTH Token should be valid for (168 hours is 1 week), Checked on Startup and on with the validate-and-rotate-oauth-token task.');
    }
    const oDetails = getOAUTHDetails();
    if (oDetails && oDetails['Expiry_Date']) {
        const now = new Date();
        // See if Expiry date is more than 24 hours, if not ask to rotate.
        if (oDetails['Expiry_Date'] < (now.getTime() + oauth_required_hours_valid * 3600 * 1000)) {
            log(WARNING, 'Your OAUTH key is expired or about to expire within ' + oauth_required_hours_valid + ' hours.');
            let decision = 'YES';
            if (doInteraction) {
                decision = await askMultipleChoiceQuestion('Would you like to rotate your OAUTH key ?', ['YES', 'NO']);
            }
            if (decision == 'YES') {
                rotateOauthToken();
            } else {
                log(INFO, 'Ok I won\'t do anything...');
            }
        } else {
            log(INFO, 'OAUTH Key(' + oDetails['Token_Name'] + ') is valid for more than ' + oauth_required_hours_valid + ' hours :-)...');
        }
    } else {
        log(WARNING, 'No OAUTH (expiry) Details Found...');
    }
}

// Function to generate an OAUTH Token
generateOauthToken = function (tokenNameOverride, verbose) {
    return new Promise(async function (resolve, reject) {
        log(INFO, 'Generating OAUTH Token...');
        const generateOauthUrl = 'https://' + getCurrentRegion() + clURI.generate_oauth
        let skipCall = false;
        // Check for Token name
        let OauthTokenName = 'MyCLIToken_1';
        if (getProp('CloudLogin.OAUTH_Generate_Token_Name') != null) {
            OauthTokenName = getProp('CloudLogin.OAUTH_Generate_Token_Name');
        } else {
            log(INFO, 'No OAUTH_Generate_Token_Name found; This is needed to specify the name of your OAUTH Token.');
            let decision = await askMultipleChoiceQuestion('Would you like to add this to ' + getPropFileName() + ' ?', ['YES', 'NO']);
            if (decision == 'YES') {
                addOrUpdateProperty(getPropFileName(), 'CloudLogin.OAUTH_Generate_Token_Name', 'MyCLIToken_1', 'Name of the OAUTH token to be generated.');
            } else {
                skipCall = true;
            }
        }
        // Override name in case of rotation
        if (tokenNameOverride) {
            OauthTokenName = tokenNameOverride;
        }
        // Check for Tenants
        let OauthTenants = 'TSC+BPM';
        if (getProp('CloudLogin.OAUTH_Generate_For_Tenants') != null) {
            OauthTenants = getProp('CloudLogin.OAUTH_Generate_For_Tenants').replace(/,/g, "+");
        } else {
            log(INFO, 'No OAUTH_Generate_For_Tenants Property found; This is needed to specify for which tenants you would like to generate an OAUTH Token');
            let decision = await askMultipleChoiceQuestion('Would you like to add this to ' + getPropFileName() + ' ?', ['YES', 'NO']);
            if (decision == 'YES') {
                addOrUpdateProperty(getPropFileName(), 'CloudLogin.OAUTH_Generate_For_Tenants', 'TSC,BPM', 'Comma separated list of tenants for which the OAUTH Token gets generated. (Options: TSC,BPM,TCDS,TCE,TCI,TCM)\n#  TSC: General Cloud Authentication\n#  BPM: LiveApps Authentication\n# TCDS: TIBCO Cloud Data Streams Authentication\n#  TCE: TIBCO Cloud Events Authentication\n#  TCI: TIBCO Cloud Integration Authentication\n#  TCM: TIBCO Cloud Messaging Authentication\n# NOTE: You need to be part of the specified subscription.');
            } else {
                skipCall = true;
            }
        }
        // Check for valid hours (336 by default; 2 weeks)
        let OauthHours = 336;
        if (getProp('CloudLogin.OAUTH_Generate_Valid_Hours') != null) {
            OauthHours = getProp('CloudLogin.OAUTH_Generate_Valid_Hours');
        } else {
            log(INFO, 'No OAuthKey_Generate_Valid_Hours found; This is needed to specify how log the OAUTH Token is valid for');
            let decision = await askMultipleChoiceQuestion('Would you like to add this to ' + getPropFileName() + ' ?', ['YES', 'NO']);
            if (decision == 'YES') {
                addOrUpdateProperty(getPropFileName(), 'CloudLogin.OAUTH_Generate_Valid_Hours', '336', 'Number of Hours the generated OAUTH token should be valid.');
            } else {
                skipCall = true;
            }
        }
        let OauthSeconds = OauthHours * 3600;
        const postRequest = 'maximum_validity=' + OauthSeconds + '&name=' + OauthTokenName + '&scope=' + OauthTenants;
        if (!skipCall) {
            // console.log('URL: ', generateOauthUrl, '\nPOST: ', postRequest)
            // A bit of a hack to do this call before re-authorizing... (TODO: put call in update token again)
            const responseClaims = callURL(getClaimsURL, null, null, null, false);
            const response = callURL(generateOauthUrl, 'POST', postRequest, 'application/x-www-form-urlencoded', false, 'TSC', 'https://' + getCurrentRegion() + clURI.general_login);
            log(INFO, response);
            if (response) {
                if (response.error) {
                    log(ERROR, response.error_description);
                } else {
                    // Display Table
                    let nvs = createTableValue('OAUTH TOKEN NAME', OauthTokenName);
                    nvs = createTableValue('NEW OAUTH TOKEN', response.access_token, nvs);
                    nvs = createTableValue('VALID TENANTS', response.scope, nvs);
                    nvs = createTableValue('TYPE', response.token_type, nvs);
                    nvs = createTableValue('EXPIRY (SECONDS)', response.expires_in, nvs);
                    nvs = createTableValue('EXPIRY (HOURS)', ((response.expires_in) / 3600), nvs);
                    nvs = createTableValue('EXPIRY (DAYS)', (((response.expires_in) / 3600) / 24), nvs);
                    console.table(nvs);
                    // Ask to update
                    let decision = '';
                    if (verbose) {
                        decision = 'YES';
                    } else {
                        decision = await askMultipleChoiceQuestion('Do you want to update ' + getPropFileName() + ' with the new token ?', ['YES', 'NO']);
                    }
                    if (decision == 'YES') {
                        //console.log('Response: ', response);
                        const expiryDate = new Date((new Date()).getTime() + (response.expires_in * 1000));
                        // ADD Get Claims Call here...
                        // console.log(responseClaims);
                        const tokenToInject = '[Token Name: ' + OauthTokenName + '][Region: ' + getRegion() + '][User: ' + responseClaims.email + '][Org: ' + getOrganization() + '][Scope: ' + response.scope + '][Expiry Date: ' + expiryDate + ']Token:' + response.access_token;
                        console.log(tokenToInject);
                        addOrUpdateProperty(getPropFileName(), 'CloudLogin.OAUTH_Token', tokenToInject);
                    }
                }
            }
        } else {
            log(INFO, 'OK, I won\'t do anything :-)');
        }
        resolve();
    });
}

const SPECIAL = 'SPECIAL';
// TODO: implement Function to update a propety (possibly in a custom file)
updateProperty = async function () {
    let doUpdate = true;
    log(INFO, 'Update a property file');
    // Ask in which file, or use default
    let pFile = await askQuestion('In which file would you like to update a property ? (use enter or default for the current property file)');
    if (pFile.toLowerCase() == 'default' || pFile == '') {
        pFile = getPropFileName();
    }
    log(INFO, '--> Property File: ', pFile);
    // Ask propname
    let pName = await askQuestion('Which property would you like to update or add ?');
    if (pName == '') {
        log(ERROR, 'You have to provide a property name');
        doUpdate = false;
    }
    // Ask prop comments
    let pComment = await askQuestion('What comment would you like to add ? (use enter on none to not provide a comment)');
    if (pComment == 'none') {
        pComment = '';
    }
    // Ask prop value
    let pValue = await askQuestion('What value would you like to add ? (use ' + SPECIAL + ' to select from a list)');
    if (pValue.toUpperCase() == SPECIAL) {
        // TODO: Add Cloud Starter Link, FlogoAppId,
        const vTChoices = ['SandboxID', 'LiveApps_AppID', 'LiveApps_ActionID'];
        const vType = await askMultipleChoiceQuestion('What type of answer would you like to add to the property ?', vTChoices);
        if (vType == 'SandboxID') {
            pValue = getProductionSandbox();
        }
        if (vType == 'LiveApps_AppID' || vType == 'LiveApps_ActionID') {
            const apps = showLiveApps(true, false);
            let laAppNameA = ['NONE'].concat(apps.map(v => v.name));
            let laAppD = await askMultipleChoiceQuestionSearch('For which LiveApp would you like to store the ID ?', laAppNameA);
            if (laAppD == 'NONE') {
                log(INFO, 'OK, I won\'t do anything :-)');
                doUpdate = false;
            } else {
                let laApp = apps.find(e => e.name == laAppD.trim());
                if (laApp == null) {
                    log(ERROR, 'App not found: ' + laAppD);
                    doUpdate = false;
                }
                if (doUpdate && vType == 'LiveApps_AppID') {
                    pValue = laApp.applicationId
                }
                if (doUpdate && vType == 'LiveApps_ActionID') {
                    let laActions = [{name: 'NONE'}];
                    if (laApp.creators) {
                        laActions = laActions.concat(laApp.creators.map(v => ({
                            type: 'CREATOR',
                            id: v.id,
                            name: v.name
                        })));
                    }
                    if (laApp.actions) {
                        laActions = laActions.concat(laApp.actions.map(v => ({
                            type: 'ACTION',
                            id: v.id,
                            name: v.name
                        })));
                    }
                    // console.log(laActions);
                    log(INFO, 'Liva Apps Actions: ');
                    console.table(laActions);
                    let laActD = await askMultipleChoiceQuestionSearch('For which ACTION would you like to store an Action ID ?', laActions.map(v => v.name));
                    if (laActD == 'NONE') {
                        log(INFO, 'OK, I won\'t do anything :-)');
                        doUpdate = false;
                    } else {
                        let laAction = laActions.find(e => e.name == laActD);
                        if (laApp != null) {
                            pValue = laAction.id
                        } else {
                            log(ERROR, 'LA Action not found: ' + laAction);
                            doUpdate = false;
                        }
                    }
                }
            }
        }
    }
    if (doUpdate) {
        addOrUpdateProperty(pFile, pName, pValue, pComment);
    }
}

// Function, that does all sorts of validations
validate = async function () {
    //console.log('Validate ',new Date());
    if (global.SHOW_START_TIME) console.log((new Date()).getTime() - global.TIME.getTime(), ' Validate');
    // TODO: Add; case_folder_exist,
    const valChoices = ['Property_exist', 'Property_is_set', 'Property_is_set_ask', 'LiveApps_app_exist', 'Live_Apps_group_exist', 'TCI_App_exist', 'Cloud_Starter_exist'];
    const valD = (await askMultipleChoiceQuestion('What would you like to validate ?', valChoices)).toLowerCase();
    log(INFO, 'Validating: ', valD);
    if (valD == 'property_exist' || valD == 'property_is_set' || valD == 'property_is_set_ask') {
        let propD = await askQuestion('Which property would you like to validate (Use plus character to validate multiple properties, for example: prop1+prop2) ?');
        let propDArray = propD.split('+');
        for (let prop of propDArray) {
            if (getProp(prop) != null) {
                validationOk('Property ' + prop + ' exists...');
                if (valD == 'property_is_set' || valD == 'property_is_set_ask') {
                    if (getProp(prop).trim() != '') {
                        validationOk('Property ' + prop + ' is set: ' + getProp(prop));
                    } else {
                        validationFailed('Property ' + prop + ' does not have a value...');
                        if (valD == 'property_is_set_ask') {
                            let propVal = await askQuestion('What value would you like to set for ' + prop + ' ?');
                            addOrUpdateProperty(getPropFileName(), prop, propVal, 'Set by validation on: ' + new Date());
                        }
                    }
                }
            } else {
                validationFailed('Property ' + prop + ' does not exist...');
                if (valD == 'property_is_set_ask') {
                    let propVal = await askQuestion('What value would you like to set for ' + prop + ' ?');
                    addOrUpdateProperty(getPropFileName(), prop, propVal, 'Set by validation on: ' + new Date());
                }
            }
        }
    }

    // Validate if a liveApps App exist
    if (valD == 'liveapps_app_exist') {
        const apps = showLiveApps(false, false);
        await validationAppHelper(apps, 'LiveApps App', 'name')
    }

    // Validate if a liveApps Group exist
    // Live_Apps_group_exist
    if (valD == 'live_apps_group_exist') {
        const groups = getGroupsTable(false);
        // console.log(iterateTable(groups));

        await validationAppHelper(iterateTable(groups), 'LiveApps Group', 'Name');
    }

    // Validate if a Flogo App exist
    if (valD == 'tci_app_exist') {
        const apps = showTCI(false);
        await validationAppHelper(iterateTable(apps), 'TCI App', 'Name');
    }

    // Validate if a Cloud Starter exist
    if (valD == 'cloud_starter_exist') {
        const apps = showAvailableApps(true);
        // console.log(apps);
        await validationAppHelper(apps, 'Cloudstarter', 'name');
    }
}

validationAppHelper = async function (apps, type, search) {
    let appToValidate = await askQuestion('Which ' + type + ' would you like to validate (Use plus character to validate multiple ' + type + 's, for example: app1+app2) ?');
    let appArray = appToValidate.split('+');
    for (let app of appArray) {
        let laApp = apps.find(e => e[search] == app.trim());
        if (laApp != null) {
            validationOk(type + ' ' + colors.blue(app) + '\033[0m exist on organization: ' + colors.blue(getOrganization()) + '\033[0m...');
        } else {
            validationFailed(type + ' ' + colors.blue(app) + '\033[0m does not exist on organization: ' + colors.blue(getOrganization()) + '\033[0m...');
        }
    }
}


validationOk = function (message) {
    log(INFO, colors.green(' [VALIDATION --OK--] \033[0m' + message))
}

validationFailed = function (message) {
    log(ERROR, colors.red('[VALIDATION FAILED] \033[0m' + message));
    process.exit(1);
}

// Function to show org folders
showOrgFolders = async function () {
    let OrgFolderLocation = './LA_Organization_Folder/'
    if (getProp('LA_Organization_Folder') != null) {
        OrgFolderLocation = getProp('LA_Organization_Folder');
    } else {
        log(INFO, 'No LA_Organization_Folder property found; We are adding it to: ' + getPropFileName());
        addOrUpdateProperty(getPropFileName(), 'LA_Organization_Folder', OrgFolderLocation, 'The location for exports and imports of the LiveApps organization folders');
    }
    const getOrgFolderURL = 'https://' + getCurrentRegion() + clURI.la_org_folders + '?$top=200';
    const oResponse = callURL(getOrgFolderURL);
    const folderTable = createTable(oResponse, mappings.la_org_folders, false);

    //TODO: Perhaps allow all let chFolder = ['NONE', 'ALL']; (for export)
    let chFolder = ['NONE'];
    for (let fNr in folderTable) {
        let noItems = callURL('https://' + getCurrentRegion() + clURI.la_org_folders + '/' + folderTable[fNr].Name + '/artifacts?$count=TRUE');
        logLine('Processing folder (' + fNr + '/' + iterateTable(folderTable).length + ')');
        folderTable[fNr]['Number of Items'] = noItems;
        if (noItems > 0) {
            chFolder.push(folderTable[fNr].Name);
        }
    }
    pexTable(folderTable, 'live-apps-org-folders', getPEXConfig(), true);
    const folderDecision = await askMultipleChoiceQuestionSearch('For which folder would you like to see the contents ?', chFolder);
    if (folderDecision != 'NONE') {
        const folderResp = callURL('https://' + getCurrentRegion() + clURI.la_org_folders + '/' + folderDecision + '/artifacts/');
        const folderContentTable = createTable(folderResp, mappings.la_org_folder_content, false);
        const users = showLiveAppsUsers(false, false);
        let chContent = ['NONE'];
        for (let cont in folderContentTable) {
            for (let usr of iterateTable(users)) {
                if (usr.Id == folderContentTable[cont]['Author']) {
                    folderContentTable[cont]['Author'] = usr['First Name'] + ' ' + usr['Last Name'];
                }
                if (usr.Id == folderContentTable[cont]['Modified By']) {
                    folderContentTable[cont]['Modified By'] = usr['First Name'] + ' ' + usr['Last Name'];
                }
            }
            chContent.push(folderContentTable[cont]['Name']);
        }
        pexTable(folderContentTable, 'live-apps-folder-folder-content', getPEXConfig(), true);
        const fileDecision = await askMultipleChoiceQuestionSearch('Which file would you like to download ?', chContent);
        if (fileDecision != 'NONE') {
            mkdirIfNotExist(OrgFolderLocation);
            mkdirIfNotExist(OrgFolderLocation + '/' + folderDecision);
            const dataForFile = callURL('https://' + getCurrentRegion() + clURI.la_org_folder_download + '/' + folderDecision + '/' + fileDecision + '?$download=true', null, null, null, true);
            const fs = require('fs');
            const fileName = OrgFolderLocation + '/' + folderDecision + '/' + fileDecision;
            fs.writeFileSync(fileName, dataForFile, 'utf8');
            log(INFO, 'LA Orgfolder data exported: ' + fileName);
        } else {
            log(INFO, 'OK, I won\'t do anything :-)');
        }
    } else {
        log(INFO, 'OK, I won\'t do anything :-)');
    }
    return folderTable;
}


/*
ORG FOLDERS:

./Cloud_Folders/
./Cloud_Folders/caseFolders
./Cloud_Folders/orgFolders

Endpoints:

GET /caseFolders/
GET /caseFolders/{folderName}/
GET /caseFolders/{folderName}/artifacts/
GET /caseFolders/{folderName}/artifacts/{artifactName}/artifactVersions

GET /orgFolders/
GET /orgFolders/{folderName}/
GET /orgFolders/{folderName}/artifacts/
GET /orgFolders/{folderName}/artifacts/{artifactName}/artifactVersions

 */

// TODO: implement Function
exportOrgFolder = function () {
    log(ERROR, 'TODO: Implement...')
}

// TODO: implement Function
importOrgFolder = function () {
    log(ERROR, 'TODO: Implement...')
}

// TODO: implement Function
watchOrgFolder = function () {
    log(ERROR, 'TODO: Implement...')
}

getGroupsTable = function (showTable) {
    let doShowTable = true;
    if (showTable != null) {
        doShowTable = showTable;
    }
    const oResponse = callURL('https://' + getCurrentRegion() + clURI.la_groups);
    const groupTable = createTable(oResponse, mappings.la_groups, false);
    pexTable(groupTable, 'live-apps-groups', getPEXConfig(), doShowTable);
    return groupTable;
}

// Function that shows live apps group and who is in it.
showLiveAppsGroups = async function () {
    const groupT = getGroupsTable();
    let selectGroup = ['NONE', 'ALL'];
    for (let gr of iterateTable(groupT)) {
        selectGroup.push(gr.Name);
    }
    const decision = await askMultipleChoiceQuestionSearch('For which group would you like to see the users ?', selectGroup);
    if (decision != 'NONE') {
        for (let gr of iterateTable(groupT)) {
            if (decision == gr.Name || decision == 'ALL') {
                const oResponse = callURL('https://' + getCurrentRegion() + clURI.la_groups + '/' + gr.Id + '/users?$sandbox=' + getProductionSandbox());
                const userGroupTable = createTable(oResponse, mappings.la_groups_users, false)
                for (let uGr in userGroupTable) {
                    //userGroupTable[uGr].assign({Group: gr.Name}, userGroupTable[uGr]);
                    userGroupTable[uGr] = Object.assign({Group: gr.Name}, userGroupTable[uGr])
                }
                log(INFO, 'Users for group: ' + gr.Name);
                pexTable(userGroupTable, 'live-apps-groups-users', getPEXConfig(), true);
            }
        }
    } else {
        log(INFO, 'OK, I won\'t do anything :-)');
    }
}

// Function to create LiveApps Group
createLiveAppsGroup = async function () {
    log(INFO, 'Creating LiveApps Group...');
    const gName = await askQuestion('What file name of the group you would like to create ? (press enter to not create a group)');
    if (gName != '') {
        const gDescription = await askQuestion('What is the description of the group  ? (press enter to leave blank)');
        let postGroup = {
            "name": gName,
            "description": gDescription,
            "type": "SubscriptionDefined"
        }
        const oResponse = callURL('https://' + getCurrentRegion() + clURI.la_groups, 'POST', postGroup);
        if (oResponse != null) {
            log(INFO, 'Successfully create group with ID: ', oResponse);
        }
    } else {
        log(INFO, 'OK, I won\'t do anything :-)');
    }
}

// Function that shows the LiveApps Users
showLiveAppsUsers = function (showTable, hideTestUsers) {
    const oResponse = callURL('https://' + getCurrentRegion() + clURI.la_users);
    const usersTable = createTable(oResponse, mappings.la_users, false);
    if (hideTestUsers) {
        for (let usr in usersTable) {
            if (usersTable[usr] && usersTable[usr].Type == 'Test') {
                delete usersTable[usr];
            }
        }
    }
    pexTable(usersTable, 'live-apps-users', getPEXConfig(), showTable);
    return usersTable;
}

// Function
addUserToGroup = async function () {
    // Show all the groups and ask to which group you would like to add a user.
    let groupIdToAdd = '';
    let userIdToAdd = '';
    const groupT = getGroupsTable();
    // TODO: perhaps allow to add a user to all groups
    // let selectGroup = ['NONE', 'ALL'];
    let selectGroup = ['NONE'];
    for (let gr of iterateTable(groupT)) {
        selectGroup.push(gr.Name);
    }
    const groupDecision = await askMultipleChoiceQuestionSearch('For which group would you like to ADD a user ?', selectGroup);
    if (groupDecision != 'NONE') {
        let currentUsersInGroupT = [];
        for (let gr of iterateTable(groupT)) {
            if (groupDecision == gr.Name) {
                groupIdToAdd = gr.Id;
                const oResponse = callURL('https://' + getCurrentRegion() + clURI.la_groups + '/' + gr.Id + '/users?$sandbox=' + getProductionSandbox());
                log(INFO, 'CURRENT USERS IN GROUP: ' + groupDecision);
                currentUsersInGroupT = createTable(oResponse, mappings.la_groups_users, true)

            }
        }
        const userT = showLiveAppsUsers(false, true);
        // TODO: perhaps allow to add a user to all groups
        //let selectedUser = ['NONE', 'ALL'];
        let selectedUser = ['NONE'];
        let allowedUsersTable = [];
        for (let usr of iterateTable(userT)) {
            let add = true;
            for (let cUsrGrp of iterateTable(currentUsersInGroupT)) {
                // console.log(cUsrGrp.Email + ' == ' + usr['Email'])
                if (cUsrGrp.Email == usr['Email']) {
                    add = false;
                }
            }
            if (add) {
                allowedUsersTable.push(usr);
                selectedUser.push(usr['First Name'] + ' ' + usr['Last Name']);
            }
        }
        log(INFO, 'Users that can be added to ' + groupDecision);
        console.table(allowedUsersTable);
        const userDecision = await askMultipleChoiceQuestionSearch('Which user would you like to add to the group (' + groupDecision + ')', selectedUser);
        if (userDecision != 'NONE') {
            if (userDecision.startsWith('ID-')) {
                userIdToAdd = userDecision.substr(3);
            }
            if (groupDecision.startsWith('ID-')) {
                groupIdToAdd = userDecision.substr(3);
            }
            for (let usr of iterateTable(userT)) {
                if (userDecision == usr['First Name'] + ' ' + usr['Last Name']) {
                    userIdToAdd = usr.Id;
                }
            }
            log(INFO, 'Adding user: ' + colors.green(userDecision) + '[ID:' + userIdToAdd + '] to ' + colors.green(groupDecision) + '[ID:' + groupIdToAdd + ']');
            const postGroupMapping = {
                sandboxId: getProductionSandbox(),
                groupId: groupIdToAdd,
                userId: userIdToAdd
            }
            const oResponse = callURL('https://' + getCurrentRegion() + clURI.la_user_group_mapping, 'POST', postGroupMapping);
            if (oResponse != null) {
                log(INFO, 'Successfully added user: ' + colors.green(userDecision) + '[ID:' + userIdToAdd + '] to ' + colors.green(groupDecision) + '[ID:' + groupIdToAdd + '] User Mapping ID: ' + oResponse);

            }
        } else {
            log(INFO, 'OK, I won\'t do anything :-)');
        }
    } else {
        log(INFO, 'OK, I won\'t do anything :-)');
    }
    // Show all the users and add that users to a group.

}

// Function to show spotfire reports
showSpotfire = function () {
    return new Promise(async function (resolve, reject) {
        // TODO: Implement
        console.log('TODO: Implement');
        resolve();
    });
}


getTIBCli = function () {
    let re = '';
    if (getProp('TIBCLI_Location') != null) {
        re = getProp('TIBCLI_Location');
    } else {
        log(INFO, 'No TIBCLI_Location property found; We are adding it to: ' + getPropFileName());
        addOrUpdateProperty(getPropFileName(), 'TIBCLI_Location', '', 'The location of the TIBCLI Executable (including the executable name, for example: /folder/tibcli)');
        log(WARNING, 'Before continuing, please download TIBCO® Cloud - Command Line Interface from https://' + getCurrentRegion() + 'integration.cloud.tibco.com/envtools/download_tibcli, and add it\'s location to ' + getPropFileName());
        process.exit(0);
    }
    return re;
}

getPEXConfig = function () {
    const re = {};
    // table-export-to-csv= YES | NO
    let table_export_to_csv = 'NO';
    if (getProp('Table_Export_To_CSV') != null) {
        table_export_to_csv = getProp('Table_Export_To_CSV');
    } else {
        log(INFO, 'No Table_Export_To_CSV property found; We are adding it to: ' + getPropFileName());
        addOrUpdateProperty(getPropFileName(), 'Table_Export_To_CSV', table_export_to_csv, 'Export tables to CSV files. Possible values YES | NO');
    }
    // table-export-folder= ./table-exports
    let table_export_folder = './table-exports/';
    if (getProp('Table_Export_Folder') != null) {
        table_export_folder = getProp('Table_Export_Folder');
    } else {
        log(INFO, 'No Table_Export_Folder property found; We are adding it to: ' + getPropFileName());
        addOrUpdateProperty(getPropFileName(), 'Table_Export_Folder', table_export_folder, 'Folder to export the CSV files to.');
    }

    // table-export-file-prefix=table-export-
    let table_export_file_prefix = 'table-export-';
    if (getProp('Table_Export_File_Prefix') != null) {
        table_export_file_prefix = getProp('Table_Export_File_Prefix');
    } else {
        log(INFO, 'No Table_Export_File_Prefix property found; We are adding it to: ' + getPropFileName());
        addOrUpdateProperty(getPropFileName(), 'Table_Export_File_Prefix', table_export_file_prefix, 'Prefix to use for the export to table CSV files.');
    }
    // table-export-tables=cloud-starters,cloud-starter-links,cloud-starter-details,live-apps,shared-states
    let table_export_tables = 'ALL';
    if (getProp('Table_Export_Tables') != null) {
        table_export_tables = getProp('Table_Export_Tables');
    } else {
        log(INFO, 'No Table_Export_Tables property found; We are adding it to: ' + getPropFileName());
        addOrUpdateProperty(getPropFileName(), 'Table_Export_Tables', table_export_tables, 'Which tables to export, Possible values: ALL (OR any of) cloud-starters,cloud-starter-links,cloud-starter-details,live-apps,shared-states');
    }
    re.export = table_export_to_csv.toLowerCase() == 'yes';
    re.folder = table_export_folder;
    re.filePreFix = table_export_file_prefix;
    re.tables = table_export_tables;
    return re;
}

/*
Messaging URL's

https://eu.messaging.cloud.tibco.com/tcm/v1/system
https://eu.messaging.cloud.tibco.com/tcm/v1/system/summary
https://eu.messaging.cloud.tibco.com/tcm/v1/system/durables
https://eu.messaging.cloud.tibco.com/tcm/v1/system/eftl/clients
https://eu.messaging.cloud.tibco.com/tcm/ui/uiapi/v1/keysInfo
https://eu.messaging.cloud.tibco.com/tcm/ui/uiapi/v1/keys/165a2ea122ea4f238b34821526f76f8f

messaging-show-summary
messaging-show-durables
messaging-show-clients
messaging-show-keys

tcli add-or-update-property -a default,Messaging.discodev.Connection_URL,none,SPECIAL,MessagingURL
tcli add-or-update-property -a default,Messaging.discodev.Authentication_Key,none,SPECIAL,MessagingKEY,LongKey


 */





// Set log debug level from local property
setLogDebug(getProp('Use_Debug'));
