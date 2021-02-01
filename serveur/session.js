// initialise la session
exports.session_init = function(app, express_session, session_secret) {
    app.use(express_session({
        secret: session_secret,
        name: 'utilisateur',
        resave: true,
        saveUninitialized: true
    }));
};

// crée une nouvelle session pour un utilisateur
exports.login = function(res, sess, nom_utilisateur, callback) {
    sess.nom_utilisateur = nom_utilisateur;
    callback();
};

// supprime la session
exports.logout = function(sess) {
    sess.destroy(function(err) {
    });
};

// retourne la session en cours
exports.session_active = function(sess, req) {
    if (sess.nom_utilisateur) {
        return sess.nom_utilisateur;
    } else {
        return 'session inexistante';
    }
};

// crée un jeton d'authentification, le met dans la base de données, le retourne
exports.creation_jeton = function(mysql, sql, base64url, crypto, socket, nom_utilisateur) {
    var token = base64url(crypto.randomBytes(20)).replace('-', '_');
    var requete_sql = '\
        INSERT INTO session(nom_utilisateur, token) VALUES(??, "??")';
    var inserts = [nom_utilisateur, token];
    requete_sql = sql.preparer(mysql, requete_sql, inserts);
    sql.requete(mysql, sql, requete_sql, function() {
        socket.emit('redirection', '/token/'+token); 
    });
}

// convertit un jeton en nom d'utilisateur et supprime le jeton de la base de données
exports.conv_jeton = function(mysql, sql, token, callback) {
    var requete_sql = 'SELECT nom_utilisateur FROM session WHERE token = "??"';
    var inserts = [token];
    requete_sql = sql.preparer(mysql, requete_sql, inserts);
    sql.requete(mysql, sql, requete_sql, function(results) {
        var requete_sql = '\
        DELETE FROM session WHERE nom_utilisateur = "'+results[0].nom_utilisateur+'"';
        sql.requete(mysql, sql, requete_sql);
        callback(results[0].nom_utilisateur);
    });
}