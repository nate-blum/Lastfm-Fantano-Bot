import { Collection, MongoClient } from 'mongodb';
import { CommandCall } from '../lastfm-models/model';

const uri = '*sensitive data*';

export class MongoInstance {
    client = new MongoClient(uri, { useUnifiedTopology: true });
    db;

    async run() {
        try {
            await this.client.connect();

            this.db = this.client.db('nate-lastfm');
        } catch (ex) {
            console.log(ex);
        }
    }

    async close() {
        await this.client.close();
    }

    async writeCall(name: string, call: CommandCall) {
        const collection: Collection = this.db.collection(name);
        if (call) {
            let _call: CommandCall = await collection.findOne({
                identifier: call.identifier,
            });
            if (_call) await collection.updateOne({ identifier: call.identifier }, { $set: { data: call.data } });
            else await collection.insertOne(call);
        }
    }

    async readCall(name: string, identifier: string): Promise<CommandCall> {
        const collection: Collection = this.db.collection(name);
        return await collection.findOne<CommandCall>({ identifier });
    }
}

export const mongoInst = new MongoInstance();
