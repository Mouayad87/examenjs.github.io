exports.f = function(io, mysql, sql, session, crypto, base64url) {

    io.on('connection', function (socket) {
  
      // vérifie si le mot de passe est correct
      socket.on('login', function (login) {
        var requete_sql = '\
          SELECT mot_de_passe \
          FROM users \
          WHERE nom_utilisateur = ??';
        var inserts = [login.nom_utilisateur];
          requete_sql = sql.preparer(mysql, requete_sql, inserts);
              
        sql.requete(mysql, sql, requete_sql, function(results) {
          try {
          /* ce bloc try-catch sert à détecter une erreur pouvant survenir
          lorsqu'on demande le mot de passe d'un utilisateur inexistant */
            if (login.password == results[0].mot_de_passe) {
              session.creation_jeton(
                mysql,
                sql,
                base64url,
                crypto,
                socket,
                login.nom_utilisateur
              );
            } else { 
              socket.emit('erreur_login'); 
            }
          }
          catch(e) {
            socket.emit('erreur_login');
          }
        });
      });
    
      // crée un nouveau compte
      socket.on('nouveau_compte', function(compte) {
        var requete_sql = 'SELECT \
          COUNT(nom_utilisateur) AS "user_exists"\
          FROM users WHERE nom_utilisateur = ??';
        var inserts = [compte.nom_utilisateur];
        requete_sql = sql.preparer(mysql, requete_sql, inserts);
        sql.requete(mysql, sql, requete_sql, function(result) {
          if (result[0].user_exists !== 0) {
            socket.emit('utilisateur_existant');
            return;
          }
          else {
            var requete_sql = '\
              INSERT INTO users(nom_utilisateur, mot_de_passe, email, nom, prenom, avatar) \
              VALUES(??, ??, ??, ??, ??, ?)';
            var inserts = [
              compte.nom_utilisateur,
              compte.password,
              compte.mail,
              compte.nom,
              compte.prenom,
              Math.floor((Math.random() * 100) + 1)
            ];
            requete_sql = sql.preparer(mysql, requete_sql, inserts);
            sql.requete(mysql, sql, requete_sql);
            session.creation_jeton(mysql, sql, base64url, crypto, socket, compte.nom_utilisateur);
          }
        });
      });
  
      // modifie les coordonnées d'un utilisateur
      socket.on('modifier_compte', function(compte) {
        var requete_sql = '\
          UPDATE users SET email = ??, nom = ??, prenom = ?? WHERE nom_utilisateur = ??';
        var inserts = [
          compte.mail,
          compte.nom,
          compte.prenom,
          compte.utilisateur
        ];
        requete_sql = sql.preparer(mysql, requete_sql, inserts);
        sql.requete(mysql, sql, requete_sql, function(results) {
          socket.emit('mod_compte_ok', {
            mail : compte.mail,
            nom : compte.nom,
            prenom : compte.prenom,
            utilisateur : compte.utilisateur,
            broadcast : false
          });
          socket.broadcast.emit('mod_compte_ok', {
            mail : compte.mail,
            nom : compte.nom,
            prenom : compte.prenom,
            utilisateur : compte.utilisateur,
            broadcast : true
          });
        });
      });
  
      // modifie le mot de passe d'un utilisateur
      socket.on('modifier_password', function(mod) { 
        var requete_sql = '\
          SELECT mot_de_passe \
          FROM users \
          WHERE nom_utilisateur = ??';
        var inserts = [mod.nom_utilisateur];
        requete_sql = sql.preparer(mysql, requete_sql, inserts);
        
        sql.requete(mysql, sql, requete_sql, function(results) {
          
          if (mod.ancien_password == results[0].mot_de_passe) {
            var requete_sql = 'UPDATE users SET mot_de_passe = ?? WHERE nom_utilisateur = ??';
            var inserts = [mod.nouveau_password, mod.nom_utilisateur];
            requete_sql = sql.preparer(mysql, requete_sql, inserts);
            sql.requete(mysql, sql, requete_sql);
            socket.emit('mod_password_ok');
          } else { 
            socket.emit('ancien_password_incorrect'); 
          }
        });
      });
  
      // publie un nouveau message et l'enregistre dans la base de données
      socket.on('nouveau_message', function (message) {
        var requete_sql = '\
          INSERT INTO messages(nom_utilisateur, contenu, date_ecriture, id_discussion, likes)\
          VALUES(??, ??, NOW(), ?, 0)';
        var inserts = [
          message.nom_utilisateur,
          message.contenu,
          message.id_discussion
        ];
        requete_sql = sql.preparer(mysql, requete_sql, inserts);
        sql.requete(mysql, sql, requete_sql);
        socket.emit('charger_dernier_message'+message.id_discussion);
        socket.broadcast.emit('charger_dernier_message'+message.id_discussion);
      });
  
      // modifie un message et l'enregistre dans la base de données
      socket.on('modification_message', function (d) {
        var requete_sql = '\
          UPDATE messages SET contenu = ??, date_modification=NOW() WHERE id_message = ?';
        var inserts = [d.contenu.replace(/'/g, "\\'"), d.id_message];
        requete_sql = sql.preparer(mysql, requete_sql, inserts);
        sql.requete(mysql, sql, requete_sql, function(results) {
          var requete_sql = '\
            SELECT * FROM messages WHERE id_message = ?';
          var inserts = [d.id_message];
          requete_sql = sql.preparer(mysql, requete_sql, inserts);
          sql.requete(mysql, sql, requete_sql, function(results) {
            
            socket.emit('update_message'+d.id_discussion, {
              id_message : results[0].id_message,
              date_modification : results[0].date_modification,
              contenu : results[0].contenu
            });
            socket.broadcast.emit('update_message'+d.id_discussion, {
              id_message : results[0].id_message,
              date_modification : results[0].date_modification,
              contenu : results[0].contenu
            });
          });
        });
      });
    
      // supprime un message (dans la base de données)
      socket.on('suppression_message_serveur', function (r) {
        var requete_sql = 'DELETE FROM messages WHERE id_message = ?';
        var inserts = [r.id_message];
        requete_sql = sql.preparer(mysql, requete_sql, inserts);
        sql.requete(mysql, sql, requete_sql);
        /* la concaténation de 'charger_dernier_message' avec l'id de la discussion
        permet d'éviter que le message se charge chez tous les utilisateurs
        ayant une discussion ouverte */
        socket.emit('suppression_message_client_'+r.id_discussion, r.id_message);
        socket.broadcast.emit('suppression_message_client_'+r.id_discussion, r.id_message);
      });
    
      /* ajoute un "like" à un message tout en vérifiant que l'utilisateur
      n'aie pas déjà aimé le message (chaque utilisateur ne peut aimer qu'une
      seule fois un message) */
      socket.on('like_message', function(d) { // id_message, nom_utilisateur
        if (d.nom_utilisateur !== 'session inexistante') {
          var requete_sql = 'SELECT nom_utilisateur FROM likes WHERE id_message = ?';
          var inserts = [d.id_message];
          requete_sql = sql.preparer(mysql, requete_sql, inserts);
          sql.requete(mysql, sql, requete_sql, function(results) {
            for (var i = 0; i < results.length; i++) {
              if (results[i].nom_utilisateur === d.nom_utilisateur) {
                var deja_like = true;
                return;
              }
            }
            if (!deja_like) {
              var requete_sql = 'SELECT likes FROM messages WHERE id_message = ?';
              requete_sql = sql.preparer(mysql, requete_sql, inserts);
              sql.requete(mysql, sql, requete_sql, function(results) {
                var likes_actuels = results[0].likes + 1;
                  var requete_sql = 'UPDATE messages SET likes = ? WHERE id_message = ?';
                var inserts = [likes_actuels, d.id_message];
                requete_sql = sql.preparer(mysql, requete_sql, inserts);
                sql.requete(mysql, sql, requete_sql);
  
                var requete_sql = 'INSERT INTO likes(id_message, nom_utilisateur) VALUES (?, ??)';
                var inserts = [d.id_message, d.nom_utilisateur];
                requete_sql = sql.preparer(mysql, requete_sql, inserts);
                sql.requete(mysql, sql, requete_sql);
  
                socket.emit('update_likes'+d.id_discussion, {
                  id_message : d.id_message,
                  nombre_likes : likes_actuels
                });
                socket.broadcast.emit('update_likes'+d.id_discussion, {
                  id_message : d.id_message,
                  nombre_likes : likes_actuels
                });
              }); 
            }
          });
        }
      });
  
      // change l'avatar d'un utilisateur
      socket.on('changement_avatar', function(d) {
        var requete_sql = 'UPDATE users SET avatar = ? WHERE nom_utilisateur = ??';
        var inserts = [d.avatar, d.nom_utilisateur];
        requete_sql = sql.preparer(mysql, requete_sql, inserts);
        sql.requete(mysql, sql, requete_sql);
      });
      
      socket.on('nouvelle_discussion', function(discussion) {
        // sélectionne le dernier ID de discussion
        var requete_sql = '\
          SELECT id_discussion FROM messages \
          ORDER BY id_discussion DESC \
          LIMIT 0,1';
        sql.requete(mysql, sql, requete_sql, function(results) {
          // incrémente le dernier ID de 1, ce qui détermine l'ID de la nouvelle discussion
          var id_nouvelle_discussion = results[0].id_discussion+1;
          // insert le premier message de la discussion
          var requete_sql = '\
            INSERT INTO messages(nom_utilisateur, contenu, date_ecriture, id_discussion, likes)\
            VALUES(??, ??, NOW(), ?, 0)';
          var inserts = [discussion.nom_utilisateur, discussion.message, id_nouvelle_discussion];
          requete_sql = sql.preparer(mysql, requete_sql, inserts);
          sql.requete(mysql, sql, requete_sql);
          // attribue le sujet à la discussion dans la table "discussions"
          var requete_sql = '\
            INSERT INTO discussions(sujet, id_discussion)\
            VALUES(??, ?)';
          var inserts = [discussion.sujet.replace(/'/g, "\\'"), id_nouvelle_discussion];
          requete_sql = sql.preparer(mysql, requete_sql, inserts);
          sql.requete(mysql, sql, requete_sql, function() {
            // redirige l'utilisateur vers la nouvelle discussion
            socket.emit('redirection', id_nouvelle_discussion);
            // requête pour charger la dernière discussion dans la page d'accueil
            socket.broadcast.emit('charger_derniere_discussion');
          });
        });
      });
    });
  }