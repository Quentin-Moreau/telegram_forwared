const config = require('./config');
const TelegramBot = require('node-telegram-bot-api');
const { MTProto, getSRPParams } = require('@mtproto/core');
const prompts = require('prompts');

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

async function getCode() {
    return new Promise((resolve, reject) => {
        bot.onText(/\/code (.+)/, (msg, match) => {
            const resp = match[1]; // the captured "whatever"

            console.log('[+] code received !');
          
            bot.removeTextListener(/\/code (.+)/);
            resolve(resp.replace('A', ''));
        });
    });
}

async function getPassword() {
    return new Promise((resolve, reject) => {
        bot.onText(/\/password (.+)/, (msg, match) => {
            const resp = match[1]; // the captured "whatever"

            console.log('[+] password received !');
          
            bot.removeTextListener(/\/password (.+)/);
            resolve(resp.replace('A', ''));
        });
    });
}

function sendCode(phone) {
    return mtproto.call('auth.sendCode', {
        phone_number: phone,
        settings: {
        _: 'codeSettings',
        },
    });
}

const mtproto = new MTProto({
    api_id: config.API_ID,
    api_hash: config.API_HASH,
});

function startListener() {
    console.log('[+] Starting listener')
    mtproto.updates.on('updates', ({ updates }) => {
        const newChannelMessages = updates
        .filter((update) => update._ === 'updateNewChannelMessage' && update.message.peer_id.channel_id === config.FROM_CHANNEL_ID)
        .map(({ message }) => message);

        for (const message of newChannelMessages) {
            // printing new channel messages
            console.log(message)

            bot.sendMessage(config.TO_CHANNEL_ID, message.message);
        }
    });
}

mtproto.call('users.getFullUser', {
    id: {
        _: 'inputUserSelf',
    },
})
.then(startListener)
.catch(async error => {

    // The user is not logged in
    console.log('[+] Login is required ... Sending access code');

    mtproto.call('auth.sendCode', {
        phone_number: config.PHONE_NUMBER,
        settings: {
            _: 'codeSettings',
        },
    })
    .catch(error => {
        console.log(error);
        if (error.error_message.includes('_MIGRATE_')) {
            const [type, nextDcId] = error.error_message.split('_MIGRATE_');

            mtproto.setDefaultDc(+nextDcId);

            return sendCode(config.PHONE_NUMBER);
        }
        console.log('[+] Couldn\'t login, aborting ...');
        process.exit(1);
    })
    .then(async result => {
        console.log(error);
        console.log('[+] Waiting for code ... (Send to your bot using /code [code])');
        const interval = setInterval(() => {}, 600000);
        const code = await getCode();
        clearInterval(interval);
        
        return mtproto.call('auth.signIn', {
            phone_code: code,
            phone_number: config.PHONE_NUMBER,
            phone_code_hash: result.phone_code_hash,
        });
    })
    .catch(error => {
        console.log(error);
        if (error.error_message === 'SESSION_PASSWORD_NEEDED') {
            return mtproto.call('account.getPassword').then(async result => {
                const { srp_id, current_algo, srp_B } = result;
                const { salt1, salt2, g, p } = current_algo;
                console.log('[+] Waiting for password ... (Send to your bot using /password [password])');
                const interval = setInterval(() => {}, 600000);
                const password = await getPassword();
                clearInterval(interval);
                
                const { A, M1 } = await getSRPParams({
                    g,
                    p,
                    salt1,
                    salt2,
                    gB: srp_B,
                    password,
                });

                return mtproto.call('auth.checkPassword', {
                    password: {
                        _: 'inputCheckPasswordSRP',
                        srp_id,
                        A,
                        M1,
                    },
                });
            });
        } else if (error.error_message === 'PHONE_CODE_EXPIRED') {
            process.exit(1);
        }
    })
    .then(result => {
        console.log('[+] Successfully authenticated');
        // start listener since the user has logged in now
        startListener()
    });
});