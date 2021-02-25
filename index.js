const config = require('./config');
const TelegramBot = require('node-telegram-bot-api');
const { MTProto, getSRPParams } = require('@mtproto/core');
const prompts = require('prompts');

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

async function getPhone() {
    return config.PHONE_NUMBER;
    /*return (await prompts({
        type: 'text',
        name: 'phone',
        message: 'Enter your phone number:'
    })).phone*/
}

async function getCode() {
    return new Promise((resolve, reject) => {
        bot.onText(/\/code (.+)/, (msg, match) => {
            // 'msg' is the received Message from Telegram
            // 'match' is the result of executing the regexp above on the text content
            // of the message
          
            const chatId = msg.chat.id;
            const resp = match[1]; // the captured "whatever"

            console.log('code', resp);
          
            bot.removeTextListener(/\/code (.+)/);
            resolve(resp.replace('A', ''));
        });
    })
    // you can implement your code fetching strategy here
    /*return (await prompts({
        type: 'text',
        name: 'code',
        message: 'Enter the code sent:',
    })).code*/
}

async function getPassword() {
    return (await prompts({
        type: 'text',
        name: 'password',
        message: 'Enter Password:',
    })).password
}

const mtproto = new MTProto({
    api_id: config.API_ID,
    api_hash: config.API_HASH,
});

function startListener() {
    console.log('[+] starting listener')
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

console.log('listening');


mtproto.call('users.getFullUser', {
    id: {
        _: 'inputUserSelf',
    },
})
.then(startListener)
.catch(async error => {

    // The user is not logged in
    console.log('[+] You must log in')
    const phone_number = await getPhone()
    console.log(phone_number);

    mtproto.call('auth.sendCode', {
        phone_number: phone_number,
        settings: {
            _: 'codeSettings',
        },
    })
    .catch(error => {
        console.log(error);
        if (error.error_message.includes('_MIGRATE_')) {
            const [type, nextDcId] = error.error_message.split('_MIGRATE_');

            mtproto.setDefaultDc(+nextDcId);

            return sendCode(phone_number);
        }
        process.exit(1);
    })
    .then(async result => {
        console.log(error);
        const interval = setInterval(() => {

        }, 600000);
        const code = await getCode();
        clearInterval(interval);
        
        return mtproto.call('auth.signIn', {
            phone_code: code,
            phone_number: phone_number,
            phone_code_hash: result.phone_code_hash,
        });
    })
    .catch(error => {
        console.log(error);
        if (error.error_message === 'SESSION_PASSWORD_NEEDED') {
            return mtproto.call('account.getPassword').then(async result => {
                const { srp_id, current_algo, srp_B } = result;
                const { salt1, salt2, g, p } = current_algo;

                const { A, M1 } = await getSRPParams({
                    g,
                    p,
                    salt1,
                    salt2,
                    gB: srp_B,
                    password: await getPassword(),
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
        console.log('[+] successfully authenticated');
        // start listener since the user has logged in now
        startListener()
    });
});