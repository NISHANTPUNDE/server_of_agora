const express = require('express');
const TeamController = require('../controllers/teamcontroller');

const router = express.Router();

router.post('/create', TeamController.createTeam);
router.get('/login', TeamController.loginTeam);
router.get('/list', TeamController.listTeams);
router.put('/update/:id', TeamController.updateTeam); 4
router.get('/get/:id', TeamController.getTeam);
router.get('/getuser/:createdby', TeamController.getallTeam);
router.delete('/delete/:id', TeamController.deleteTeam);

module.exports = router;
