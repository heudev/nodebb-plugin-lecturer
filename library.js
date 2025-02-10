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
        const coursesList = await db.getSetMembers('courses:list');
        // Eğer veritabanından veri gelmezse varsayılan dersleri döndür
        if (!coursesList || coursesList.length === 0) {
            return courses; // Varsayılan dersler dizisini kullan
        }
        return coursesList;
    } catch (err) {
        winston.error(`[lecturer-plugin] Dersler getirilirken hata oluştu: ${err.message}`);
        // Hata durumunda varsayılan dersleri döndür
        return courses;
    }
};

// API rotaları
plugin.addRoutes = function ({ router, middleware }) {
    const middlewares = [
        middleware.ensureLoggedIn,
    ];

    // API rotalarını düzenliyoruz
    const prefix = '/api/v1/plugins/lecturer';

    // Ders listesi API'si - Önce bunu public yapalım
    router.get(prefix + '/courses', async (req, res) => {
        try {
            const courses = await plugin.getCourses();
            res.json(courses || courses);  // Eğer undefined dönerse boş array döndür
        } catch (err) {
            winston.error(`[lecturer-plugin] Dersler getirilirken hata oluştu: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    });

    router.post(prefix + '/add', middlewares, async (req, res) => {
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

    router.post(prefix + '/vote', middlewares, async (req, res) => {
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

    router.get(prefix + '/list/:courseSection', async (req, res) => {
        try {
            const lecturers = await plugin.getLecturers(req.params.courseSection);
            res.json(lecturers);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
};

// Eklenti başlatma
plugin.init = async function (params) {
    try {
        winston.info('[lecturer-plugin] Eklenti başlatılıyor...');

        // Önce courses:list setini temizleyelim
        await db.delete('courses:list');

        // Tüm dersleri kontrol et ve ekle
        for (const course of courses) {
            try {
                // Dersi doğrudan listeye ekle
                await db.setAdd('courses:list', course);
                winston.info(`[lecturer-plugin] Ders eklendi: ${course}`);
            } catch (err) {
                winston.error(`[lecturer-plugin] Ders eklenirken hata oluştu (${course}): ${err.message}`);
            }
        }

        winston.info('[lecturer-plugin] Eklenti başarıyla başlatıldı');
        return;
    } catch (err) {
        winston.error(`[lecturer-plugin] Eklenti başlatılırken kritik hata oluştu: ${err.message}`);
        throw err;
    }
};

module.exports = plugin; 