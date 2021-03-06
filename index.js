const env = require('dotenv').config();
process.env.NTBA_FIX_319 = 1;
const TelegramBot = require('node-telegram-bot-api');
const { MTProto, getSRPParams } = require('@mtproto/core');
const { storage } = require('./Storage');

console.log('[+] Starting telegram Bot ...');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log('[+] Telegram Bot started');

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

let proto_conf = {
    api_id: process.env.API_ID,
    api_hash: process.env.API_HASH
};

if (process.env.DATABASE_URL) {
    proto_conf.customLocalStorage = storage
}

const mtproto = new MTProto(proto_conf);

function startListener() {
    console.log('[+] Starting listener')
    mtproto.updates.on('updates', ({ updates }) => {
        const newChannelMessages = updates
        .filter((update) => update._ === 'updateNewChannelMessage' && update.message.peer_id.channel_id === parseInt(process.env.FROM_CHANNEL_ID))
        .map(({ message }) => message);

        for (const message of newChannelMessages) {
            // printing new channel messages
            console.log('[-] Forwarding message :')
            console.log(message.message);

            bot.sendMessage('-100' + process.env.TO_CHANNEL_ID, message.message);
        }
    });
}

console.log('[+] Initializing Telegram client ...');
mtproto.call('users.getFullUser', {
    id: {
        _: 'inputUserSelf',
    },
})
.catch(async error => {

    // The user is not logged in
    console.log('[+] Login is required ... Sending access code');

    return mtproto.call('auth.sendCode', {
        phone_number: process.env.PHONE_NUMBER,
        settings: {
            _: 'codeSettings',
        },
    })
    .catch(error => {
        console.log('[+] Error ... Sending code again');
        if (error.error_message && error.error_message.includes('_MIGRATE_')) {
            const [type, nextDcId] = error.error_message.split('_MIGRATE_');

            mtproto.setDefaultDc(+nextDcId);

            return sendCode(process.env.PHONE_NUMBER);
        }
        console.log('[+] Couldn\'t login, aborting ...');
        process.exit(1);
    })
    .then(async result => {
        console.log('[+] Waiting for code ... (Send to your bot using /code [code])');
        const interval = setInterval(() => {}, 600000);
        const code = await getCode();
        clearInterval(interval);
        
        return mtproto.call('auth.signIn', {
            phone_code: code,
            phone_number: process.env.PHONE_NUMBER,
            phone_code_hash: result.phone_code_hash,
        });
    })
    .catch(error => {
        console.log('[+] Password required ...');
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
})
.then(_ => {
    console.log('[+] Telegram client initialized');
    startListener();
})
.catch(error => {
    console.log('[+] An error occured');
    console.log(error);
    process.exit(1);
});