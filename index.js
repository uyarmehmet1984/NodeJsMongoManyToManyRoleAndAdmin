const express = require('express');
const mongoose = require('mongoose');
const ejs = require('ejs');
const bcrypt = require('bcryptjs');
const session = require('express-session');


const app = express();
const PORT = 4000;

// MongoDB bağlantısı
mongoose.connect('mongodb://localhost:27017/manyToOne', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User ve Role modellerini oluştur
const userSchema = new mongoose.Schema({
  email: String,
  password:String,
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
});

const roleSchema = new mongoose.Schema({
  name: String,
});


// Kullanıcı oluşturulmadan önce şifreyi hash'le
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const hashedPassword = await bcrypt.hash(this.password, 10);
    this.password = hashedPassword;
    next();
  } catch (error) {
    return next(error);
  }
});







const User = mongoose.model('User', userSchema);
const Role = mongoose.model('Role', roleSchema);

// Express middleware
app.use(express.json());

app.use(express.urlencoded({ extended: true }));  // URL-encoded verileri işlemek için gerekli middleware

//Session İçin Ekledim
app.use(session({
  secret: '198402', // Güvenli bir anahtar belirtmelisiniz
  resave: false,
  saveUninitialized: true,
}))



 // EJS kullanımı için view engine tanımlama Aşağısı ejs içinde gösetrmek için
 app.set('view engine', 'ejs');
 app.set('views', __dirname + '/views');
 

app.get('/',async(req,res)=>
{
  res.send('Express\'e hoş geldiniz!');
  
});



// API endpoint'i
app.get('/users', async (req, res) => {
  try {
    // Kullanıcıları ve rolleri birleştirerek getir
    const users = await User.find().populate('roleId', 'name');
    //Bu kod olursa bir json olarak gösterir res.json(users);
    //Aşağıdaki res.render('users', { users }); bu ise render ediyor bir ejs ye
    res.render('users', { users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API endpoint'i - Roller
app.get('/roles', async (req, res) => {
  try {
    // Rolleri getir
    const roles = await Role.find();
    res.json(roles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// POST /roles endpoint'i - Rol oluşturma Burası Api
app.post('/roles', async (req, res) => {
    try {
      // İstekten gelen verileri al
      const { name } = req.body;
  
      // Yeni rol oluştur
      const newRole = new Role({
        name,
      });
  
      // Rolü kaydet
      const savedRole = await newRole.save();
  
      res.status(201).json(savedRole);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
 
// GET /add-role endpoint'i - Rol ekleme formunu göster Burası da aynı ejs
app.get('/add-role', (req, res) => {
  res.render('addRole');
});


// GET /add-user endpoint'i - Kullanıcı ekleme formunu göster
app.get('/add-user', async (req, res) => {
  try {
    // Tüm rolleri getir
    const roles = await Role.find();
    res.render('addUser', { roles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /add-user endpoint'i - Kullanıcı eklemeyi işle
app.post('/add-user', async (req, res) => {
  try {
    const { email, roleId , password } = req.body;
    
    // E-posta adresinin daha önce eklenip eklenmediğini kontrol et
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // Eğer e-posta adresi zaten varsa hata döndür. Bu aşağıdaki kod bir json Döndürür 
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanılıyor.' });
    }

    // Yeni kullanıcı oluştur
    const newUser = new User({
      email,
      roleId,
      password,
    });

    // Kullanıcıyı kaydet
    const savedUser = await newUser.save();

    res.status(201).json(savedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/login', (req, res) => {

  if(req.session.user)
  {

    res.redirect('/');
  }
  else{res.render('login');}
  
});



// POST /login endpoint'i - Kullanıcı girişini işle
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Kullanıcıyı e-posta adresine göre bul
    const user = await User.findOne({ email }).populate('roleId','name');

    // Eğer kullanıcı yoksa veya şifre uyuşmuyorsa hata döndür
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Başarıyla giriş yapıldığında session veya token oluşturabilirsiniz.
    // Örneğin session:
    req.session.user = user;

    // Kullanıcının rolüne göre yönlendirme yapabilirsiniz.
    if (user.roleId&&user.roleId.name==='Admin') {
   
      res.redirect('/admin');
    } else {
      res.redirect('/user');
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// GET /admin endpoint'i - Admin sayfasını göster
app.get('/admin', (req, res) => {
  res.render('admin/admin'); // views klasörü içindeki admin.ejs sayfasını render eder
});

// GET /user endpoint'i - Kullanıcı sayfasını göster
app.get('/user', (req, res) => {
  res.render('user/user'); // views klasörü içindeki user.ejs sayfasını render eder
});


// GET /logout endpoint'i - Kullanıcıyı logout işlemini gerçekleştir
app.get('/logout', (req, res) => {
  // Session'ı temizle
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    
    // Kullanıcıyı login sayfasına yönlendir
    res.redirect('/login');
  });
});





// Server'ı dinle
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
