import mongoose, {Schema} from 'mongoose';

const SubscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    channel: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }

},{timestamp: true});

export const Subscription = mongoose.model('Subscription', SubscriptionSchema);