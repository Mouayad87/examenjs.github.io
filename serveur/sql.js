/* crée une connection toujours active entre
le serveur et la base de données */
exports.pool = function(mysql) {
    var pool = mysql.createPool({
      host     : 'localhost',
      user     : 'root',
      password : 'root',
      database : 'database',
      charset  : 'UTF8_UNICODE_CI',
      multipleStatements : true
    });
    return pool;
  }
  
  // exécute une requête SQL
  exports.requete = function(mysql, sql, requete_sql, callback) {
    sql.pool(mysql).getConnection(function(err, connection) {
      connection.query(requete_sql, function(err, results) { 
        sql.query_error(err);
        if(callback) {
          callback(results);
        }
        connection.destroy();
      });
    });
  }
  
  exports.query_error = function(erreur) {
    if (erreur) { 
      console.log('query error : ' + erreur.stack); 
    }
  }
  
  // prépare une requête SQL
  exports.preparer = function(mysql, requete_sql, inserts) {
    requete_sql = mysql.format(requete_sql, inserts)
      .replace(/`/g, "'")
      .replace(/'\.'/g, ".");
    return requete_sql;
  }
  
  // retourne toutes les informations pour afficher un profil
  exports.profil = function(mysql, sql, utilisateur, callback) {
    var requete_sql = 'SELECT * FROM users WHERE nom_utilisateur = ??';
    var inserts = [utilisateur];
    requete_sql = sql.preparer(mysql, requete_sql, inserts);
    sql.requete(mysql, sql, requete_sql, function(results) {
      
      callback(results[0]);
    });
  }
  
  // charge les discussions sur la page d'accueil
  exports.chargement_discussions = function(mysql, sql, tout_charger, callback) {
    if (tout_charger) {
      // toutes les discussions sont chargées
      var requete_sql = '\
        SELECT id_discussion\
        FROM discussions\
        ORDER BY id_discussion';
    }
    else {
      // seule la dernière discussion est chargée
      var requete_sql = '\
        SELECT id_discussion\
        FROM discussions\
        ORDER BY id_discussion DESC\
        LIMIT 0,1';
    }
    
    sql.requete(mysql, sql, requete_sql, function(results) {  
      var requete_sql = '';
      for (var i = 0; i < results.length; i++) {
        var requete_temp = '\
          SELECT\
            COUNT(messages.id_message) AS "nombre_messages",\
            discussions.sujet,\
            discussions.id_discussion,\
            messages.nom_utilisateur AS "utilisateur_createur",\
            messages.date_ecriture\
          FROM discussions, messages\
          WHERE discussions.id_discussion = messages.id_discussion\
          AND messages.id_discussion = ?\
          ORDER BY messages.date_ecriture\
          LIMIT 0,1;';
        var inserts = [results[i].id_discussion];
        requete_sql = requete_sql + sql.preparer(mysql, requete_temp, inserts);
      }
      sql.requete(mysql, sql, requete_sql, function(results) {
        
        if (tout_charger) {
          callback(results);
        } else {
          callback([results]);
        }
      }); 
    });
  }
  
  // retourne le sujet d'une discussion
  exports.sujet_discussion = function(mysql, sql, id_discussion, callback) {
    var requete_sql = 'SELECT sujet FROM discussions WHERE id_discussion = ?';
    var inserts = [id_discussion];
    requete_sql = sql.preparer(mysql, requete_sql, inserts);
    
    sql.requete(mysql, sql, requete_sql, function(results) {
      callback(results[0].sujet);
    });
  }
  
  // charge tous ou le dernier des messages d'une discussionl
  exports.chargement_messages = function(
    id_discussion,
    mysql,
    sql,
    tout_charger,
    callback) {
  
      // requête SQL pour vérifier si la discussion existe
      var requete_sql = '\
        SELECT id_discussion\
        FROM discussions\
        WHERE id_discussion = ?';
      var inserts = [id_discussion];
      requete_sql = sql.preparer(mysql, requete_sql, inserts);
      
      sql.requete(mysql, sql, requete_sql, function(results) {
        
        // on vérifie si la variable results[0] contient l'id de discussion
        if (!results[0]) {
          // on retourne false à l'argument discussion_existante
          // ceci est ensuite traité par routes.js et envoie une page d'erreur
          callback(false);
  
        } else {
          // on récupère d'abord le sujet de la discussion
          sql.sujet_discussion(mysql, sql, id_discussion, 
            function(sujet_discussion) {
  
              // une fois qu'on l'a on récupère tous les messages
              var requete_sql = '\
                SELECT\
                  messages.id_message AS "id_message",\
                  messages.nom_utilisateur AS "nom_utilisateur",\
                  messages.contenu AS "contenu",\
                  messages.date_ecriture AS "date_ecriture",\
                  messages.date_modification AS "date_modification",\
                  messages.id_discussion AS "id_discussion",\
                  messages.likes AS "likes",\
                  users.avatar AS "avatar"\
                FROM users, messages\
                WHERE messages.id_discussion = ?\
                AND messages.nom_utilisateur = users.nom_utilisateur\
                ORDER BY messages.date_ecriture';
              
              // si on ne veut que le dernier message...
              if (!tout_charger) {
                requete_sql += ' DESC LIMIT 0,1';
              }
  
              var inserts = [id_discussion];
              requete_sql = sql.preparer(mysql, requete_sql, inserts);
  
              sql.requete(mysql, sql, requete_sql, function(results) {
                // enfin, on peut envoyer le sujet de discussion et les messages
                callback(true, sujet_discussion, results);
              });
            }
          );
        }
      }
    );
  }