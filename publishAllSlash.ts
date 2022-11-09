import slashDefs from './slashdefs.json';
import Axios from 'axios';

(async () => {
    //do 5 at a time or it rate limits
    for (let i = 8; i < slashDefs.length; i++) {
        let res = await Axios.post('https://discord.com/api/v8/applications/*sensitive data*/commands', slashDefs[i], {
            headers: {
                'Content-Type': 'application/json',
                Authorization: '*sensitive data*',
            },
        });
        console.log(res.status, slashDefs[i].name);
        await timeout(3000);
    }
})();

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
