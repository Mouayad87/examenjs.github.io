exports.f = function(
    app,
    session,
    express,
    path,
    dossier,
    mysql,
    sql,
    express_session,
    crypto,
    base64url
  ) {
  
    // le chiffre 7 pourrait être n'importe quel autre chiffre ou lettre
    var session_secret = base64url(crypto.randomBytes(20)).replace('-', '7')
    session.session_init(app, express_session, session_secret);
    // la session est initiée dans express.js
  
    app.get('/token/:token', function(req, res) {
      session.conv_jeton(mysql, sql, req.params.token, function(nom_utilisateur) {
        session.login(res, req.session, nom_utilisateur, function() {
          res.redirect(301, '/');
        });
      });
    });
  
    // page de login
    app.get('/login', function(req, res) {
      res.render('login.ejs', {
        nom_utilisateur: session.session_active(req.session, req)
      });
    });
  
    // page de logout
    app.get('/logout', function(req, res) {
      session.logout(req.session);
      // redirection vers login
      res.redirect(301, '/login');
    });
  
    // page de nouveau compte
    app.get('/nouveau_compte', function(req, res) {
      res.render('nouveau_compte.ejs', {
        nom_utilisateur: session.session_active(req.session, req)
      });
    });
    
    // page de profil
    app.get(/^\/profil_([a-z0-9]{4,10})/i, function(req, res) {
      sql.profil(mysql, sql, req.params[0], function(result) {
            res.render('profil.ejs', {
              nom_utilisateur: session.session_active(req.session, req),
              profil : result
            });
      });
    });
  
    // page d'accueil
    app.get(/^\/home|\/$/, function(req, res) {
      sql.chargement_discussions(mysql, sql, true, function(discussions) {
        res.render('index.ejs', {
          nom_utilisateur: session.session_active(req.session, req),
          discussions: discussions
        });
      });
    });
  
    // dernière discussion - utilisée par des requêtes AJAX
    app.get('/derniere_discussion', function(req, res) {
      /* ici, la variable tout_charger vaut false,
      car nous ne voulons que la dernière discussion */
      sql.chargement_discussions(mysql, sql, false, function(discussion) {
        res.render('chargement_discussions.ejs', {
          discussions: discussion
        });
      });
    });
  
    // page de discussions
    app.get(/^\/([0-9]{1,9})$/, function(req, res) {
      sql.chargement_messages(req.params[0], mysql, sql, true,
        function(discussion_existante, sujet_discussion, messages) {
          if (!discussion_existante) {
            res.render('erreur_discussion.ejs');
          }
          else {
            res.render('discussion.ejs', {
              nom_utilisateur: session.session_active(req.session, req),
              sujet_discussion: sujet_discussion,
              m : messages
            });
          }
        }
      );
    });
  
    // dernier message (d'une discussion) - utilisé par des requêtes AJAX
    app.get(/^\/dernier_([0-9]{1,9})$/, function(req, res) {
      sql.chargement_messages(req.params[0], mysql, sql, false,
        function(discussion_existante, sujet_discussion, messages) {
          res.render('chargement_messages.ejs', {
            nom_utilisateur: session.session_active(req.session, req),
            m: messages
          });
        }
      );
    });
  
    // page de nouvelle discussion
    app.get('/new', function(req, res) {
      res.render('new.ejs', {
        nom_utilisateur: session.session_active(req.session, req)
      });
    });
  
    // fichiers statiques
    app.get(/static\/([0-9a-z\.\/_-]+)$/i, function(req, res) {
      res.sendFile(dossier + '/static/' + req.params[0]);
    });
  
    // page d'erreur
    app.use(function(req, res, next) {
      res.render('error.ejs');
    });
  
  };