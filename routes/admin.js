const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admincontroller');

router.post('/create', AdminController.createAdmin);
router.get('/list', AdminController.listAdmins);
router.put('/update/:id', AdminController.updateAdmin);
router.delete('/delete/:id', AdminController.deleteAdmin);
router.get('/get/:id', AdminController.getAdmin);
router.post('/login', AdminController.loginAdmin);

module.exports = router;