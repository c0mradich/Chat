
'use client';

import { useState, useEffect, useRef } from "react";
import styles from "./data.module.css";
import { changeAvatar } from "../components/Input/changeAvatar";


const apiURL = process.env.NEXT_PUBLIC_API_URL;

export default function PersonalSettings() {
  const fileInputRef = useRef(null);
  const [name, setName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [avatar, setAvatar] = useState(null)

  const hasChanges = name.trim() !== initialName;
  const isValid = name.trim().length > 3;

  useEffect(() => {
    async function fetchName() {
      try {
        const res = await fetch(`${apiURL}/aboutMe`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Не удалось загрузить данные профиля.");
        }

        const userData = await res.json();
        console.log(userData)
        const currentName = userData.name ?? "";
        const  avatar_from_data = userData.avatar ?? ""
        avatar_from_data && setAvatar(avatar_from_data)

        setName(currentName);
        setInitialName(currentName);
      } catch (e) {
        setError(e.message || "Произошла ошибка.");
      } finally {
        setLoading(false);
      }
    }

    fetchName();
  }, []);

  async function handleSave(event) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (saving || !hasChanges || trimmedName.length <= 3) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(`${apiURL}/aboutMe`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!res.ok) {
        throw new Error("Не удалось сохранить изменения.");
      }

      setName(trimmedName);
      setInitialName(trimmedName);
      setSuccess(true);
    } catch (e) {
      setError(e.message || "Произошла ошибка при сохранении.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingCard}>
          <span className={styles.spinner} />
          <p>Загружаем настройки...</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.topLine}>
          <a href="/" className={styles.backLink}>
            <span aria-hidden="true">←</span>
            <span>Вернуться в чат</span>
          </a>

          <span className={styles.settingsBadge}>
            <span className={styles.statusDot} />
            Настройки
          </span>
        </div>

        <header className={styles.header}>
          <div className={styles.avatarWrapper}>
            {!avatar ? (
              <div className={styles.avatar} aria-hidden="true">
                {name.trim().charAt(0).toUpperCase() || "?"}
              </div>
            ) : (
              <img
                src={`${apiURL}${avatar.startsWith("/") ? "" : "/"}${avatar}`}
                alt="Аватар"
                className={styles.avatarImage}
              />
            )}

            <button
              type="button"
              className={styles.avatarUpload}
              aria-label="Изменить аватар"
              title="Изменить аватар"
              onClick={() => fileInputRef.current?.click()}
            >
              ✎
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={async (e) => {
                const result = await changeAvatar(e, name);

                if (!result.success) {
                  setError(result.message);
                  e.target.value = "";
                  return;
                }

                setSuccess(result.message);
                setAvatar(result.path);
                e.target.value = "";
              }}
            />
          </div>

          <div>
            <p className={styles.eyebrow}>ВАШ АККАУНТ</p>
            <h1 className={styles.title}>Настройки профиля</h1>
            <p className={styles.subtitle}>
              Управляйте своими личными данными.
            </p>
          </div>
        </header>

        <div className={styles.divider} />

        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.sectionHeading}>
            <h2>Личная информация</h2>
            <p>Измените имя, которое видят другие пользователи.</p>
          </div>

          <label htmlFor="name" className={styles.label}>
            Имя пользователя
          </label>

          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon} aria-hidden="true">
              @
            </span>

            <input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
                setSuccess(false);
              }}
              className={styles.input}
              placeholder="Введите имя"
              autoComplete="nickname"
              minLength={4}
              maxLength={40}
              required
              disabled={saving}
            />
          </div>

          <p className={styles.hint}>
            Не менее 4 символов. Пробелы по краям не учитываются.
          </p>

          {error && (
            <div className={styles.errorMessage} role="alert">
              <span aria-hidden="true">!</span>
              {error}
            </div>
          )}

          {success && (
            <div className={styles.successMessage} role="status">
              <span aria-hidden="true">✓</span>
              Изменения успешно сохранены.
            </div>
          )}

          <div className={styles.formFooter}>
            <span className={styles.changeStatus}>
              {hasChanges ? "Есть несохранённые изменения" : "Всё актуально"}
            </span>

            <button
              type="submit"
              disabled={saving || !hasChanges || !isValid}
              className={styles.button}
            >
              {saving ? (
                <>
                  <span className={styles.buttonSpinner} />
                  Сохранение...
                </>
              ) : (
                <>
                  Сохранить изменения
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          </div>
        </form>

        <footer className={styles.cardFooter}>
          <span>Настройки аккаунта</span>
          <span>Личные данные</span>
        </footer>
      </section>

      <p className={styles.pageNote}>
        Изменения вступят в силу после сохранения.
      </p>
    </main>
  );
}
