'use strict';

const db = require.main.require('./src/database');
const winston = require.main.require('winston');

const plugin = {};

// Ders listesi (örnek)
const courses = [
    'ENG 101-1',
    'ENG 101-2',
    'MATH 101-1',
    'MATH 101-2'
];

// Hoca ekleme fonksiyonu
plugin.addLecturer = async function (courseSection, lecturerName, uid) {
    try {
        const lecturerKey = `lecturer:${courseSection}:${lecturerName}`;
        const exists = await db.exists(lecturerKey);

        if (!exists) {
            await db.setObject(lecturerKey, {
                courseSection: courseSection,
                name: lecturerName,
                votes: 0,
                addedBy: uid,
                timestamp: Date.now()
            });

            // Ders için hoca listesine ekleme
            await db.setAdd(`lecturers:${courseSection}`, lecturerName);
            return { success: true };
        }
        return { success: false, message: 'Bu hoca zaten eklenmiş.' };
    } catch (err) {
        winston.error(`[lecturer-plugin] Hoca eklenirken hata oluştu: ${err.message}`);
        throw err;
    }
};

// Hoca oylama fonksiyonu
plugin.voteLecturer = async function (courseSection, lecturerName, uid, voteType) {
    try {
        const lecturerKey = `lecturer:${courseSection}:${lecturerName}`;
        const voteKey = `lecturer:votes:${courseSection}:${lecturerName}`;

        // Kullanıcının daha önce oy verip vermediğini kontrol et
        const hasVoted = await db.isSetMember(voteKey, uid);
        if (hasVoted) {
            return { success: false, message: 'Daha önce oy kullanmışsınız.' };
        }

        // Oyu kaydet
        await db.setAdd(voteKey, uid);

        // Oy sayısını güncelle
        if (voteType === 'up') {
            await db.incrObjectField(lecturerKey, 'votes');
        } else {
            await db.decrObjectField(lecturerKey, 'votes');
        }

        return { success: true };
    } catch (err) {
        winston.error(`[lecturer-plugin] Oylama sırasında hata oluştu: ${err.message}`);
        throw err;
    }
};

// Ders için hocaları getirme fonksiyonu
plugin.getLecturers = async function (courseSection) {
    try {
        const lecturerNames = await db.getSetMembers(`lecturers:${courseSection}`);
        const lecturers = [];

        for (const name of lecturerNames) {
            const lecturerData = await db.getObject(`lecturer:${courseSection}:${name}`);
            if (lecturerData) {
                lecturers.push(lecturerData);
            }
        }

        return lecturers;
    } catch (err) {
        winston.error(`[lecturer-plugin] Hocalar getirilirken hata oluştu: ${err.message}`);
        throw err;
    }
};

// Ders listesini getirme fonksiyonu
plugin.getCourses = async function () {
    try {
        return await db.getSetMembers('courses:list');
    } catch (err) {
        winston.error(`[lecturer-plugin] Dersler getirilirken hata oluştu: ${err.message}`);
        throw err;
    }
};

// API rotaları
plugin.addRoutes = function ({ router, middleware }) {
    const middlewares = [
        middleware.ensureLoggedIn,
    ];

    router.post('/lecturer/add', middlewares, async (req, res) => {
        try {
            const result = await plugin.addLecturer(
                req.body.courseSection,
                req.body.lecturerName,
                req.uid
            );
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/lecturer/vote', middlewares, async (req, res) => {
        try {
            const result = await plugin.voteLecturer(
                req.body.courseSection,
                req.body.lecturerName,
                req.uid,
                req.body.voteType
            );
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/lecturer/list/:courseSection', async (req, res) => {
        try {
            const lecturers = await plugin.getLecturers(req.params.courseSection);
            res.json(lecturers);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Ders listesi API'si
    router.get('/lecturer/courses', async (req, res) => {
        try {
            const courses = await plugin.getCourses();
            res.json(courses);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
};

// Eklenti başlatma
plugin.init = async function (params) {
    try {
        winston.info('[lecturer-plugin] Eklenti başlatıldı');

        // Tüm dersleri kontrol et ve eksik olanları ekle
        for (const course of courses) {
            const courseKey = `course:${course}`;
            const exists = await db.exists(courseKey);

            if (!exists) {
                await db.setObject(courseKey, {
                    name: course,
                    createdAt: Date.now()
                });

                // Dersi genel ders listesine ekle
                await db.setAdd('courses:list', course);
                winston.info(`[lecturer-plugin] Yeni ders eklendi: ${course}`);
            }
        }

        winston.info('[lecturer-plugin] Ders listesi kontrolü tamamlandı');
    } catch (err) {
        winston.error(`[lecturer-plugin] Eklenti başlatılırken hata oluştu: ${err.message}`);
        throw err;
    }
};

module.exports = plugin; 