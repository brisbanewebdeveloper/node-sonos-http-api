# Frontend Integration with Alpine.js

## Fundamentals

- Fun project to make myself familiarize with [Alpine.js](https://alpinejs.dev/).

- This app is for my iPhone but share the progress since the backend logic uses https://github.com/jishi/node-sonos-http-api.

- Make the app look like Sonos official app so that it should be easier to using their app again once the issues are resolved.

## Requirements

- Node.js

- Coding skill if you want to use your own version. The dimension for mobile devices differ so that you would want to amend CSS.

## Installation

### Install Node.js

- Windows
  + Visit the official Node.js website https://nodejs.org/.
  + Click on the `Windows Installer` button to download the latest stable version (LTS) of Node.js.

- Mac
  + Please ask AI or google how to do it as there are multiple ways to do this.

- Linux
  + You can use this app with Docker or with Node.js. Omitting the details as I expect you can do this by yourself.

### Download App

- Open [this page](https://github.com/brisbanewebdeveloper/node-sonos-http-api/tree/alpine.js).

- Click the green button saying `Code` and select `Download ZIP` (or fork the repository to create your own version).

- Unzip the file at your server or the PC you run the app. You must run this app in the same local network where your Sonos speakers are.
  + Unlike Sonos official app, this app needs to keep running within your local network. You open the app with a browser in your mobile device and operate your Sonos devices via this app.

### Install Dependencies

Translate the following to meet your situation if you are not Windows User:

1. Open `Command Prompt` with `Run as administrator`.

2. Change the current directory to the app folder, `node-sonos-http-api-alpine.js`, in the command prompt.

Run the following command:

```
npm install
```

### Customise App

Copy the file `static/app.html` as `static/app-custom.html`.

Amend the line where it says `http://localhost:5005` in `static/app-custom.html`.

For example, if your PC to run this app has the IP address `192.168.0.123`, change it to `http://192.168.0.123:5005`.

[Additional Info]

In my case, I already run this app in a different purpose and it has the hostname so that the default port 5005 needs to altered. Let's say I use the port `12345` instead. In that case, I put it like `http://example-host:12345`.

### Create Setting File

Create a file `settings.json` and put the following (If you do npt use the default port 5005, it needs to match up; In above example, you put `"port": "12345"` between the curly brackets):

```json
{
   "port": "5005"
}
```

### Run App

```
npm run start
```

### Test

This is to confirm your mobile device can access to the app.

Open the URL you put in `static/app-custom.html` with a browser in your mobile device.

For example:

```
http://192.168.0.123:5005
```

Your browser should show the page saying `Sonos API`.

### Use App

This is to use the app.

Add `/app-custom.html` to the URL bar to open the app.

For example:

```
http://192.168.0.123:5005/app-custom.html
```

### How To Stop

Press `Ctrl + C` to stop running the app.

### Uninstall

- Please google or ask AI about uninstalling Node.js.

- To uninstall this Sonos Controller, just delete the directory having this file.

## Using Docker

Since `static/app-custom.html` ia mounted as `static/app.html`:

```
http://192.168.0.123:5005/app.html
```

#### Run Docker Container

If you run the app with Linux and Docker (This example shows you have created your own `static/app.css` and `static/app.js` to remain the original file to have your own behaviour, and run in headless mode instead of using Electron):

```shell
docker run \
-d \
--network host \
-v $(pwd)/settings.json:/app/settings.json \
-v $(pwd)/presets:/app/presets \
-v $(pwd)/static/app-custom.css:/app/static/app.css \
-v $(pwd)/static/app-custom.js:/app/static/app.js \
-v $(pwd)/static/app-custom.html:/app/static/app.html \
node-sonos-http \
npm run headless
```
