// contains certificate password, not on github for obvious reasons :)
const {certificateFile, certificatePassword} = require("./certconfig.js")
module.exports = {
    "makers": [
        {
            "name": "@electron-forge/maker-squirrel",
            "config": {
                "loadingGif": "loading.gif",
                "setupIcon": "icon.ico",
                "iconUrl": "https://github.com/HexCodeFFF/aidatasetfromvideo/blob/master/icon.ico?raw=true",
                "remoteReleases": "https://github.com/HexCodeFFF/aidatasetfromvideo",
                certificateFile: certificateFile,
                certificatePassword: certificatePassword
            }
        }
    ],
    "packagerConfig": {
        "icon": "icon.ico",
        "ignore": [
            "\\.github",
            "\\.idea",
            "datasets-\\d+",
            "dataset-combined-\\d+",
            "out",
            "screenshots",
            "certconfig\\.js",
            "codeSignCert\\.pfx"
        ]
    },
    "publishers": [
        {
            "name": "@electron-forge/publisher-github",
            "config": {
                "repository": {
                    "owner": "HexCodeFFF",
                    "name": "captionthing"
                },
                "prerelease": true
            }
        }
    ]
}