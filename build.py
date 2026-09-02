#!/usr/bin/env python3
"""Збирає data/ для Mini App: предмети, їхні плани, конспекти й матеріали.

Предмет — окремий вимір. Розклад дає повний список предметів курсу; ті, для
яких є навчальний план і розшифровані конспекти, отримують теми з матеріалом,
решта лишаються в списку порожніми, щоб було видно, чого ще немає.
"""
import hashlib, json, pathlib, re, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "miniapp" / "data"
RESOURCES = ROOT / "KonspektKit" / "Sources" / "KonspektKit" / "Resources"

# Сталий колір предмета: розклад читається периферійним зором.
HUES = {
    "Анатомія тварин": 222, "Гістологія": 168, "Хімія": 38, "Латинська мова": 276,
    "Історія України та цивілізаційний процес": 344,
    "Іноземна мова (за професійним спрямуванням)": 142,
    "Антикорупція та доброчесність": 200, "Основи національного спротиву": 14,
}
SHORT = {
    "Історія України та цивілізаційний процес": "Історія",
    "Іноземна мова (за професійним спрямуванням)": "Іноземна",
    "Основи національного спротиву": "Спротив",
    "Антикорупція та доброчесність": "Доброчесність",
    "Анатомія тварин": "Анатомія",
    "Латинська мова": "Латина",
}

def hue_of(subject: str) -> int:
    if subject in HUES:
        return HUES[subject]
    value = 7
    for char in subject:
        value = (value * 31 + ord(char)) % 360
    return value

def main() -> int:
    if DATA.exists():
        shutil.rmtree(DATA)
    DATA.mkdir(parents=True)

    timetable = json.loads((ROOT / "schedule" / "fvm122.json").read_text(encoding="utf-8"))
    (DATA / "schedule.json").write_text(json.dumps(timetable, ensure_ascii=False), encoding="utf-8")

    linked = dict(timetable.get("curricula", {}))

    # Предмет може мати конспекти задовго до того, як хтось сфотографує його
    # робочу програму: теку з конспектами прив'язує сам файл, полем subjectTitle.
    for folder in sorted((ROOT / "notes").glob("*")):
        if not folder.is_dir():
            continue
        for notes_file in folder.glob("T*.json"):
            notes = json.loads(notes_file.read_text(encoding="utf-8"))
            title = notes.get("subjectTitle")
            if title and title not in linked:
                linked[title] = notes["curriculumID"]

    subjects = []

    for name in dict.fromkeys(session["subject"] for session in timetable["sessions"]):
        curriculum_id = linked.get(name)
        subject = {
            "id": curriculum_id or f"subject-{hue_of(name)}",
            "title": name,
            "short": SHORT.get(name, name),
            "hue": hue_of(name),
            "curriculum": None,
            "topics": [],
        }

        if curriculum_id:
            source = RESOURCES / f"{curriculum_id}.json"
            if source.exists():
                target = f"curriculum-{curriculum_id}.json"
                (DATA / target).write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
                subject["curriculum"] = target

            notes_dir = ROOT / "notes" / curriculum_id
            for notes_file in sorted(notes_dir.glob("T*.json")) if notes_dir.exists() else []:
                notes = json.loads(notes_file.read_text(encoding="utf-8"))
                topic_id = notes["topicID"]
                built = ROOT / "generated" / curriculum_id / topic_id
                folder = DATA / curriculum_id / topic_id
                folder.mkdir(parents=True, exist_ok=True)

                topic = {"id": topic_id, "title": notes["title"], "notes": None,
                         "lesson": None, "quiz": None, "cards": None}
                (folder / "notes.json").write_text(
                    notes_file.read_text(encoding="utf-8"), encoding="utf-8")
                topic["notes"] = f"{curriculum_id}/{topic_id}/notes.json"

                for kind in ("lesson", "quiz", "cards"):
                    made = built / f"{kind}.json"
                    if made.exists():
                        (folder / f"{kind}.json").write_text(
                            made.read_text(encoding="utf-8"), encoding="utf-8")
                        topic[kind] = f"{curriculum_id}/{topic_id}/{kind}.json"

                subject["topics"].append(topic)

        subjects.append(subject)

    # Предмети з матеріалом — першими: студентка тицяє в них щодня.
    subjects.sort(key=lambda subject: (not subject["topics"], not subject["curriculum"]))

    (DATA / "subjects.json").write_text(
        json.dumps({"subjects": subjects}, ensure_ascii=False, indent=2), encoding="utf-8")

    version = stamp()
    ready = sum(len(s["topics"]) for s in subjects)
    print(f"предметів: {len(subjects)}, тем із матеріалом: {ready}, версія {version}")
    return 0


def stamp() -> str:
    """Проставляє відбиток версії в index.html.

    Telegram тримає сторінку в своєму вебв'ю довго. Поки адреса скрипта не
    змінюється, він показує старий застосунок; зміна ?v= змушує перечитати і
    скрипт, і дані, які він тягне.
    """
    digest = hashlib.sha256()
    for path in sorted((ROOT / "miniapp").rglob("*")):
        if path.is_file() and path.name != "index.html" and ".git" not in path.parts:
            digest.update(path.read_bytes())
    version = digest.hexdigest()[:10]

    index = ROOT / "miniapp" / "index.html"
    text = re.sub(r'src="app\.js(\?v=[0-9a-f]+)?"', f'src="app.js?v={version}"', index.read_text(encoding="utf-8"))
    index.write_text(text, encoding="utf-8")
    return version

if __name__ == "__main__":
    sys.exit(main())
