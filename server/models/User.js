import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  // name: String, required, trim
  // email: String, required, unique, lowercase, match: email regex
  // password: String, required, minlength: 6, select: false
  // createdAt: Date, default: Date.now
  // updatedAt: Date, default: Date.now
});

// pre('save'): skip if password not modified
//              set updatedAt, genSalt(10), hash password → next()

// methods.matchPassword: bcrypt.compare(enteredPassword, this.password)

// index: { email: 1 }, unique

export default mongoose.model('User', userSchema);