'use client';
import { useState, useEffect } from "react";
import styles from "./data.module.css";

const apiURL = process.env.NEXT_PUBLIC_API_URL

export default function PersonalSettings() {
  const [name, setName] = useState("");
  const [data, setData] = useState("")
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchName() {
      try {
        const res = await fetch(`${apiURL}/aboutMe`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Error by loading data");
        const someData = await res.json();
        setData(someData)
        setName(someData.name);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchName();
  }, []);

  const handleSave = async () => {
    if(name!==data.name && name.length>3){
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiURL}/aboutMe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Error by saving");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
    }

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className={styles.container}>
      <label htmlFor="name" className={styles.label}>
        Имя пользователя:
      </label>
      <input
        id="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={styles.input}
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className={styles.button}
      >
        {saving ? "Сохраняю..." : "Сохранить изменения"}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
