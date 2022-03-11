const PULL_REQUEST_PATH_REGEXP = /.+\/([^/]+)\/(pull)\/[^/]+\/(.*)/;

function getOptions() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get({
            basePath: '',
            insidersBuild: false,
            debug: false,
        }, (options) => {
            if (options.basePath === '') {
                reject(new Error('Looks like you haven\'t configured this extension yet. Visit the options page before using this extension. More information on the extension README.'));
                return;
            }

            resolve(options);
        });
    });
}

function getVscodeLink({
    file, isFolder, line,
}) {
    return getOptions()
        .then(({ insidersBuild, basePath, debug }) => {
            let vscodeLink = insidersBuild
                ? 'vscode-insiders'
                : 'vscode';

            vscodeLink += '://file';

            // windows paths don't start with slash
            if (basePath[0] !== '/') {
                vscodeLink += '/';
            }

            vscodeLink += `${basePath}/${file}`;

            // opening a folder and not a file
            if (isFolder) {
                vscodeLink += '/';
            }

            if (line) {
                vscodeLink += `:${line}:1`;
            }

            if (debug) {
                alert(`About to open link: ${vscodeLink}`);
            }

            return vscodeLink;
        });
}

function isPR(linkUrl) {
    return PULL_REQUEST_PATH_REGEXP.test(linkUrl);
}

const SENTRY_RE = /([\w./-]+) [\w\s]+ at line (\d+)/g

function parseLink(linkUrl, selectionText, pageUrl) {
    return new Promise((resolve, reject) => {
        var line;
        var file = selectionText;
        if (!linkUrl) {
            
            var split = selectionText.split(":")
            if (split.length > 1) {
                file = split[0]
                line = split[1]
            } else {
                var allMatches = [...selectionText.matchAll(SENTRY_RE)][0]
                if (allMatches.length > 2) {
                    file = allMatches[1]
                    line = allMatches[2]
                }
            }

            resolve({
                file,
                isFolder: false,
                line,
            });
        }

        const url = new URL(linkUrl);
        const path = url.pathname;

        if (isPR(url.pathname)) {
            const pathInfo = PULL_REQUEST_PATH_REGEXP.exec(path);
            const isFolder = false;
            file = selectionText;
            let line = null;
            if (pageUrl.includes(linkUrl)) {
                line = pageUrl.replace(linkUrl, '').replace('R', '').replace('L', '');
            }
            resolve({
                file,
                isFolder,
                line,
            });
            return;
        }

        const pathRegexp = /.+\/([^/]+)\/(blob|tree)\/[^/]+\/(.*)/;

        if (!pathRegexp.test(path)) {
            reject(new Error(`Invalid link. Could not extract info from: ${path}.`));
            return;
        }

        const pathInfo = pathRegexp.exec(path);

        const isFolder = pathInfo[2] === 'tree';
        var file = pathInfo[3];

        if (url.hash.indexOf('#L') === 0) {
            line = url.hash.substring(2);
        }

        resolve({
            file,
            isFolder,
            line,
        });
    });
}

function openInVscode({ linkUrl, selectionText, pageUrl }) {
    parseLink(linkUrl, selectionText, pageUrl)
        .then(getVscodeLink)
        .then(window.open)
        .catch(alert);
}

chrome.contextMenus.create({
    title: 'Open in VSCode',
    contexts: ['link', 'selection'],
    onclick: openInVscode,
});
