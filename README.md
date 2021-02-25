# Telegram Forwared

Telegram forwared is a mex between a bot and an app to allow you to forward messages from a channel to another, even if it is private.

## Installation

This app is developed in Node.js, use npm to install dependencies.

These are the steps to run the app in local mode

```bash
npm i
```

Then setup a `.env` file containing the following

```bash
API_ID=<API_ID as an integer, from https://my.telegram.org/auth>
API_HASH='<API_HASH as string, from https://my.telegram.org/auth>'
FROM_CHANNEL_ID=<channel you want to forware the messages from, as integer, without -100 before>
TO_CHANNEL_ID=<channel you want to forware the messages to, as integer, without -100 before>
BOT_TOKEN='<Your bot token fetched from @BotFather as string>'
PHONE_NUMBER='<Your phone number in international format as string>'
```

## Usage

Once ran, send a message to your bot containing the login code you juste received using the following command
```bash
/code [code]
```

You might need to alter it as Telegram wont allow you to send a login code, if needed, for a code like `45879`, send it in the format `/code 4A5A8A7A9`.

## Heroku

/!\ You will need the Heroku CLI /!\

Click on this button to deploy to heroku.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

Once the app is created and deployed, open the heroku CLI and run the following commands

```bash
heroku ps:scale web=0 worker=1 -a <app-name>
heroku ps:restart -a <app-name>
```