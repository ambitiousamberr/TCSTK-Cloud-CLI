# TIBCO Cloud™ Starters Toolkit - Command Line Interface 
<img src="https://community.tibco.com/sites/default/files/tibco_labs_final_with_tm2-01.png" alt="drawing" width="100"/>Powered by [TIBCO Labs™](https://community.tibco.com/wiki/tibco-labs)

Command Line Interface for creating TIBCO Cloud™ Starter Projects [(For more information see the Full Documentation)](https://tibcosoftware.github.io/TCSToolkit/cli/tutorials/001_TCLI_Overview/) 

### TIBCO Cloud™ CLI) Installation:
```
npm install -g @tibco-tcstk/cloud-cli
``` 

###TIBCO Cloud™ CLI) Usage: 
```
tcli [new / <task>][--debug(-d)] [--createCP(-c)] [--help(-h)] [--version(-v)] [--update(-u)] [--propfile(-p)] [--multiple(-m) --multipleFile(-f) <multiple-file-name> --job(-j) <job-name> --environment(-e) <environment name>] [--multipleInteraction(-i)] [--surpressStart(-s)] [--answers(a) <answers>]
```

Note: When you just run "tcli" it will bring you in an interactive menu based on the context.

### Create new Tibco Cloud™ starter:
```
tcli new
```
And answer the questions, or provide the answers inline:
```
tcli new <name> [--template(-t)] <template-to-use>
```
* debug: Display debug information.
   
* createCP: Create a new tibco-cloud.properties file.

* help: display help 

* version: display the version number

* update: update the tcli

* propfile: when specified tcli will use a different property file then the default tibco-cloud.properties

* multiple: run the task specified in the configured multiple property file. This allows you to execute tasks on many cloud starters and many different configured environments at the same time.

* multipleFile: when specified tcli will use a different property file then the default manage-multiple-cloud-starters.properties you can optionally specify a job to run and an environment to run this in; this is handy in integrating with CI/CD Buildpipelines.

* multipleInteraction: when specified, the multiple file will also be used, but in an interactive way. This is extremely handy if you want to run specific tcli jobs on multiple environments quickly.

* surpressStart: When using this option after creating a new cloud starter the interactive tcli will not start.

* answers: a comma(,) or column(:) separated list of answers to interactive questions. This is useful to run the tcli completely verbose; useful in a build-pipeline. 
    
These are the available TIBCO Cloud™ CLI Tasks:

| TASK | Description |
|------|:------------|
|                    show-cloud  | Show Cloud Details |
 |                     show-cloud-starters |  Show Applications of LiveApps WebApps |
 |        show-cloud-starter-links |  Show Links to Applications of LiveApps WebApps |
|show-properties|  Show the properties in your properties file (and possibly the global values)|
 |                 change-region |  Change the Region in the tibco-cloud properties file |
 |                     obfuscate-password |  Obfuscate a password and put it in the tibco-cloud properties file |
 |                         start-cloud-starter |  Start your local cloud starter project |
 |                         build-cloud-starter |  Build your local cloud starter project |
|test-cloud-starter|  Run Test cases for your cloud starter|
|test-cloud-starter-headless|  Run Test cases for your cloud starter, headless (without opening the browser)|
 |                        deploy-cloud-starter |  Deploy your local cloud starter project |
 |                   build-deploy-cloud-starter |  Builds and Deploys your local project to the cloud |
 |           delete-cloud-starter|  Delete a cloud starter from the cloud |
 |            inject-lib-sources |  Enables your project for Cloud Library Debugging |
 |              undo-lib-sources |  Undo enabling your project for Cloud Library Debugging |
 |                 schematic-add |  Add a component template (schematic) into your project |
 |             view-global-config|  View the global cloud connection configuration |
 |           update-global-config|  Update the global cloud connection configuration |
 |              show-shared-state|  Show the shared state contents |
 |      show-shared-state-details|  Shows the details of one Shared State entry |
|create-shared-state-entry|  Create a new shared state entry|
 |       clear-shared-state-entry|  Removes one Shared State entry |
 |      clear-shared-state-filter|  Removes all shared state entries in the configured filter |
 |            export-shared-state|  Downloads all shared state entries from the configured filter to the local file system |
 |            import-shared-state|  Uploads one entry or the configured filter from the local file system to the shared state |
 |             watch-shared-state|  Monitors the local shared state and when changes are detected it is uploaded to the cloud |
 |  create-multiple-property-file|  Creating an initial property file to manage multiple cloud starters and environments |
 |         replace-string-in-file|  Replace string in file following the Replace_FROM, Replace_TO and Replace_PATTERN properties |
 |           show-live-apps-cases|  Show Live Apps Cases |
 |     export-live-apps-case-type|  Export the details of a Live Apps Case Type |
 |                   export-live-apps-cases|  Export Data from Live Apps |
 |  generate-live-apps-import-configuration|  Generate the Live Apps Import configuration file |
 |                   import-live-apps-cases|  Import Cases to Live Apps |
 |generate-cloud-descriptor|  Generates the configured Public Cloud Descriptor |
 |update-cloud-packages|  Updates the NPM packges in the @tibco-tcstk scope in your project. |
 |show-tci-apps|  List all TIBCO Cloud Integration Applications(Flogo, Scribe, Node.JS & Business Works). |
 |monitor-tci-app|  Monitor the logs of a TIBCO Cloud Integration Flogo Application |
 |show-oauth-tokens|  Displays OAUTH tokens to authenticate to the TIBCO Cloud. |
 |generate-oauth-token|  Generate a new OAUTH token to authenticate to the TIBCO Cloud. |
 |revoke-oauth-token|  Revokes an existing OAUTH token. |
 |rotate-oauth-token|  Revokes your existing OAUTH token and then generates a new one. |
 |validate-and-rotate-oauth-token|  Checks if OAUTH token is valid for more than a configured time (1 week for example) and if not, it will rotate it. |
 |generate-cloud-property-files|  Generates a list of cloud property files (used to interact with multiple cloud organizations) |
 |show-org-folders|  Displays the content of the LiveApps Organization Folders, and allow you to download content. |
 |show-live-apps-groups|  Displays the LiveApps groups and their users. |
 |create-live-apps-group|  Creates a new LiveApps group. |
 |show-live-apps-users|  Shows the users in LiveApps (which can be added to groups). |
 |add-user-to-group|  Adds a user to a LiveApps group. |
 |validate|  Validates the setting of a property & the value of a property or validates the existence of a Cloud Starter, LiveApps app or TCI App.|
 |add-or-update-property|  Adds or Updates a property in a file.|
|messaging-show-summary|  Show summary of cloud messaging|
|messaging-show-clients|  Show clients of cloud messaging|
|browse-spotfire-library|  List Spotfire Analytical Reports and browse through folders on the Spotfire Library|
 |                    update-tcli|  Update the Cloud CLI |
 |                          exit |  Quit the console |
 |                          help |  Display's help message|


---
For more information see the [TCSTK Documentation](https://tibcosoftware.github.io/TCSToolkit/)
---

# License

Copyright © 2021. TIBCO Software Inc.
This file is subject to the license terms contained
in the license file that is distributed with this file.

Please see tpc.txt for details of license and dependent third party components referenced by this library, or it can be found here:

https://github.com/TIBCOSoftware/TCSTK-Cloud-CLI/blob/master/tpc.txt
