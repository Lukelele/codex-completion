const vscode = require('vscode');
const axios = require("axios");

/**
 * @param {vscode.ExtensionContext} context
 */


 class ColorsViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(data => {
            if (data == "generate") {
                vscode.commands.executeCommand("codex-completion.generate");
            } else if (data == "set-api-key") {
				vscode.commands.executeCommand("codex-completion.set-api");
			} else if (data == "change-settings") {
				vscode.commands.executeCommand("codex-completion.change-settings");
			} else if (data == "change-engine") {
				vscode.commands.executeCommand("codex-completion.change-engine");
			}
        });
    }

    _getHtmlForWebview(webview) {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

        const nonce = getNonce();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				
				<title>Codex Completion</title>
			</head>
			<body>
				<ul class="color-list">
				</ul>
                <h1 id="p1">Codex Completion</h1>
				<span class="a">Context Referencing</span>
				<label class="switch">
  				<input type="checkbox" id="reference-slider" checked>
  				<span class="slider"></span>
				</label>
				<button id="generate-button">Generate Code</button>


				<p>        </p>
    			<br>
				<br>
    			<p>        </p>
				<button id="api-key-button">Set API Key</button>
				<button id="engines-button">Change Engine</button>
				<button id="settings-button">Change Settings</button>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}
ColorsViewProvider.viewType = 'codex-completion-sidebar';

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

var fileEndingNames = {
    '.py': '#Python 3',
    '.c': '//C',
    '.cpp': '//C++',
    '.html': '<!DOCTYPE html>',
    '.css': '/*CSS*/',
    '.js': '//JavaScript',
    '.swift': '//Swift',
    '.java': '/*Java*/',
    '.cs': '/*C#*/',
    '.php': '/*PHP*/',
	".ipynb": "#Python 3",
	".r": "#R"
}

function extractSubtext(string, lineNum, charNum, inputLimit, fileEnding){
	
    var linesArray = string.split('\n');
	var firstLines;
	if (lineNum != 0) {
    	firstLines = linesArray.slice(0,lineNum);
	}
	else {
		firstLines = [];
	}
    var lastLine = linesArray[lineNum];
    var firstChars = lastLine.slice(0,charNum);
    var result = firstLines.concat(firstChars);

    result = result.join('\n')
	result = result.substring(result.length-inputLimit);

	var fileEndingText = fileEndingNames[fileEnding];
	if (fileEndingText == undefined) {
		fileEndingText = '"' + fileEnding + '"';
	}

	result = result.replace(/^\s+/, '');	

	result = `${fileEndingText}


${result}`;

	result = result.replace(/\s+$/, '');

	console.log((result));

	return result;
  }





async function activate(context) {	
	if (context.environmentVariableCollection.get("api-key") == undefined) {
		vscode.commands.executeCommand("codex-completion.set-api");
	}
	if (context.environmentVariableCollection.get("@codex.temperature") == undefined) {
		context.environmentVariableCollection.append("@codex.temperature", 0.1);
	}
	if (context.environmentVariableCollection.get("@codex.top_p") == undefined) {
		context.environmentVariableCollection.append("@codex.top_p", 1.0);
	}
	if (context.environmentVariableCollection.get("@codex.max_tokens") == undefined) {
		context.environmentVariableCollection.append("@codex.max_tokens", 32);
	}
	if (context.environmentVariableCollection.get("@codex.frequency_penalty") == undefined) {
		context.environmentVariableCollection.append("@codex.frequency_penalty", 0.05);
	}
	if (context.environmentVariableCollection.get("@codex.presence_penalty") == undefined) {
		context.environmentVariableCollection.append("@codex.presence_penalty", 0.0);
	}
	if (context.environmentVariableCollection.get("@codex.reference_limit") == undefined) {
		context.environmentVariableCollection.append("@codex.reference_limit", 256);
	}
	if (context.environmentVariableCollection.get("@codex.engine") == undefined) {
		context.environmentVariableCollection.append("@codex.engine", "davinci-codex");
	}


    const provider = new ColorsViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ColorsViewProvider.viewType, provider));

	let generateCommand = vscode.commands.registerCommand('codex-completion.generate', async function () {


		const editor = vscode.window.activeTextEditor;

		let filename = editor.document.fileName
		let fileEnding = filename.substring(filename.indexOf("."), filename.length);

		if (fileEnding != ".ipynb") {
    		vscode.window.showTextDocument(editor.document);
		}

		var key = context.environmentVariableCollection.get("api-key").value;

        let text = editor.document.getText();
		let subtext = extractSubtext(text, editor.selection.active.line, editor.selection.active.character, context.environmentVariableCollection.get("@codex.reference_limit").value, fileEnding);

		let engine = context.environmentVariableCollection.get("@codex.engine").value;

		if (context.environmentVariableCollection.get("api-key").value == "") {
			vscode.window.showWarningMessage("Enter your API key");
		}
		else {
			vscode.window.showInformationMessage("Generating Code...");
		}


        axios.post("https://api.openai.com/v1/engines/" + engine + "/completions", {
			prompt: subtext,
            temperature: context.environmentVariableCollection.get("@codex.temperature").value,
			max_tokens: context.environmentVariableCollection.get("@codex.max_tokens").value,
	        top_p: context.environmentVariableCollection.get("@codex.top_p").value,
	        frequency_penalty: context.environmentVariableCollection.get("@codex.frequency_penalty").value,
	        presence_penalty: context.environmentVariableCollection.get("@codex.presence_penalty").value,
            stop: "\n\n",
			stream: false
		}, {
			headers: {
			"Content-Type": "application/json",
			"Authorization": "Bearer " + key
			}
		}).then(function(response) {
            console.log(response.config);
			console.log(response.data.choices);
            editor.edit(function (e) {
                e.replace(editor.selection, response.data.choices[0].text);
            });
			vscode.window.showInformationMessage("Complete.");
        }).catch(function(error) {
			vscode.window.showErrorMessage("Request failed to send, check API key");
			console.log("Request failed to send, check API key");
            console.log(error);
			context.environmentVariableCollection.replace("api-key", "");
        })
	});


	let apiCommand = vscode.commands.registerCommand("codex-completion.set-api", async function() {
		vscode.window.showInputBox({
			password: true,
			title: "Codex API Key",
			prompt: "Set Your API Key:"
		}).then(function(key) {
			context.environmentVariableCollection.replace("api-key", key);
		}).catch(function(error){
			console.log(error);
		})
	});

	


	let changeSettings = vscode.commands.registerCommand('codex-completion.change-settings', async () => {

		var temperature = 'temperature:  ' + context.environmentVariableCollection.get("@codex.temperature").value;
		var max_tokens = 'max_tokens:  ' + context.environmentVariableCollection.get("@codex.max_tokens").value;
		var top_p = 'top_p:  ' + context.environmentVariableCollection.get("@codex.top_p").value;
		var frequency_penalty = 'frequency_penalty:  ' + context.environmentVariableCollection.get("@codex.frequency_penalty").value;
		var presence_penalty = 'presence_penalty:  ' + context.environmentVariableCollection.get("@codex.presence_penalty").value;
		var reference_limit = 'reference_limit:  ' + context.environmentVariableCollection.get("@codex.reference_limit").value;

		const selected = await vscode.window.showQuickPick([
			temperature, max_tokens, top_p, frequency_penalty, presence_penalty, reference_limit
		], {
			canPickMany: false,
			title: 'Change Parameters'
		});

		var options;
		if (selected === temperature) {
			options = {
				title: 'Temperature [0, 1]',
				placeHolder: '0',
				prompt: 'Temperature is a floating point no. (eg. 0.7)'
			};
		} else if (selected === max_tokens) {
			options = {
				title: "max_tokens [1, 4096]",
				placeHolder: '128',
				prompt: 'max_tokens is no. of tokens generated'
			};
		} else if (selected === top_p) {
			options = {
				title: "top_p [0, 1]",
				placeHolder: '1',
				prompt: 'Controls diversity'
			};
		} else if (selected === frequency_penalty) {
			options = {
				title: "Frequency_penalty [0, 2]",
				placeHolder: '0',
				prompt: 'Decrease models repeatability'
			};
		} else if (selected === presence_penalty) {
			options = {
				title: 'Presence Penalty [0, 2]',
				placeHolder: '0',
				prompt: 'increase likelihood of creativity',
			}
		}else if (selected === reference_limit) {
			options = {
				title: 'Reference Limit [0, 1024]',
				placeHolder: '0',
				prompt: 'How many characters before the selection Codex references for completion',
			};
		}

		const value = await vscode.window.showInputBox(options);
		if (value == undefined) {
			return;
		}
		if (selected === temperature) {
			const num = parseFloat(value);
			if (!isNaN(num)) {
				if (num < 0 || num > 1) {
					vscode.window.showWarningMessage(`Codex:Invalid Temperature entered ${num}`);
				} else {
					context.environmentVariableCollection.replace('@codex.temperature', num);
				}
			}
		} else if (selected === max_tokens) {
			const num = parseInt(value);
			if (!isNaN(num)) {
				if (num > 0 && num <= 4096) {
					context.environmentVariableCollection.replace("@codex.max_tokens", num);
				} else {
					vscode.window.showWarningMessage(`Codex: Invalid value for max_tokens ${num}`);
				
				}
			}
		} else if (selected === top_p) {
			const num = parseFloat(value);
			if (!isNaN(num)) {
				if (num >= 0 && num <= 1) {
					context.environmentVariableCollection.replace("@codex.top_p", num);
				} else {
					vscode.window.showWarningMessage(`Codex: Invalid value for top_p ${num}`);
				
				}
			}
		} else if (selected === frequency_penalty) {
			const num = parseFloat(value);
			console.log(num);
			if (!isNaN(num)) {
				if (num >= 0 && num <= 2) {
					context.environmentVariableCollection.replace("@codex.frequency_penalty", num);
				} else {
					vscode.window.showWarningMessage(`Codex: Invalid value for frequency_penalty ${num}`);
				}
			}
		} else if (selected === presence_penalty) {
			const num = parseFloat(value);
			if (!isNaN(num)) {
				if (num >= 0 && num <= 2) {
					context.environmentVariableCollection.replace("@codex.presence_penalty", num);
				} else {
					vscode.window.showWarningMessage(`Codex: Invalid value for presence_penalty ${num}`);
				
				}
			}
		} else if (selected === reference_limit) {
			const num = parseFloat(value);
			if (!isNaN(num)) {
				if (num >= 0 && num <= 1024) {
					context.environmentVariableCollection.replace("@codex.reference_limit", num);
				} else {
					vscode.window.showWarningMessage(`Codex: Invalid value for reference_limit ${num}`);
				}
			}
		}
	});


	let engineCommand = vscode.commands.registerCommand("codex-completion.change-engine", async function() {
		const selected = await vscode.window.showQuickPick([
			'davinci-codex', 'cushman-codex', 'davinci-instruct', 'curie-instruct', 'davinci', 'curie', 'babbage', 'ada'
		], {
			canPickMany: false,
			title: 'Change the Completion Engine'
		});


		if (selected === 'davinci-codex') {
			context.environmentVariableCollection.replace("@codex.engine", "davinci-codex");
		} else if (selected === 'cushman-codex') {
			context.environmentVariableCollection.replace("@codex.engine", "cushman-codex");
		} else if (selected === 'davinci-instruct') {
			context.environmentVariableCollection.replace("@codex.engine", "davinci-instruct-beta");
		} else if (selected === 'curie-instruct') {
			context.environmentVariableCollection.replace("@codex.engine", "curie-instruct-beta");
		} else if (selected === 'davinci') {
			context.environmentVariableCollection.replace("@codex.engine", "davinci");
		} else if (selected === 'curie') {
			context.environmentVariableCollection.replace("@codex.engine", "curie");
		} else if (selected == "babbage") {
			context.environmentVariableCollection.replace("@codex.engine", "babbage");
		} else if (selected == "ada") {
			context.environmentVariableCollection.replace("@codex.engine", "ada");
		}
		
	});

	context.subscriptions.push(changeSettings);
	context.subscriptions.push(generateCommand);
	context.subscriptions.push(apiCommand);
	context.subscriptions.push(engineCommand);
}


function deactivate() {}

module.exports = {
	activate,
	deactivate
}