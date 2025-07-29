from flask import Flask, redirect, url_for, render_template, request, session, flash
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.secret_key = "porno"
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class users(db.Model):
    _id = db.Column("id", db.Integer, primary_key=True)
    name = db.Column("name", db.String(100))
    password = db.Column("password", db.String(100))

    def __init__(self, name, password):
        self.name = name
        self.password = password

@app.route("/")
def home():
    return render_template('index.html', person="Adolf Hitler")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        usr = request.form["username"]
        password = request.form["password"]
        session["user"] = usr
        found_user = users.query.filter_by(name=usr).first()
        if found_user:
            session["password"] = found_user.password
        else:
            new_user = users(usr, password)
            db.session.add(new_user)
            db.session.commit()
        flash("You have been logged in!")
        return redirect(url_for("user", name=usr))
    else:
        return render_template("login.html")

@app.route('/user/<name>')
def user(name):
    return render_template("user.html", name=name)

@app.route('/admin')
def admin():
    db.drop_all()
    db.create_all()
    return redirect(url_for("user", name="Admin!"))

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
