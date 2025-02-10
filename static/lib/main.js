'use strict';

$(document).ready(function () {
    // Dersleri yükle
    function loadCourses() {
        const select = $('#courseSection');
        select.empty();
        select.append('<option value="">Ders Seçiniz</option>');

        $.ajax({
            url: '/api/v1/plugins/lecturer/courses',
            method: 'GET',
            success: function (courses) {
                if (Array.isArray(courses) && courses.length > 0) {
                    // Dersleri ekle
                    courses.forEach(function (course) {
                        select.append(`<option value="${course}">${course}</option>`);
                    });
                } else {
                    console.warn('Hiç ders bulunamadı');
                    select.append('<option value="" disabled>Ders bulunamadı</option>');
                }
            },
            error: function (xhr, status, error) {
                console.error('Dersler yüklenirken hata:', error);
                select.append('<option value="" disabled>Dersler yüklenemedi</option>');
                app.alertError('Dersler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.');
            }
        });
    }

    // Sayfa yüklendiğinde dersleri yükle
    loadCourses();

    // Hoca ekleme modalını oluştur
    const modal = `
        <div class="modal fade" id="addLecturerModal" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Hoca Ekle</h5>
                        <button type="button" class="close" data-dismiss="modal">
                            <span>&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="addLecturerForm">
                            <div class="form-group">
                                <label>Ders ve Section</label>
                                <select class="form-control" id="courseSection" required>
                                    <!-- Dersler dinamik olarak eklenecek -->
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Hoca Adı</label>
                                <input type="text" class="form-control" id="lecturerName" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">İptal</button>
                        <button type="button" class="btn btn-primary" id="submitLecturer">Ekle</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    $('body').append(modal);

    // Hoca listesi container'ını oluştur
    const container = `
        <div class="lecturer-container">
            <h3>Ders Hocaları</h3>
            <button class="btn btn-primary mb-3" id="addLecturerBtn">Hoca Ekle</button>
            <div class="lecturer-list"></div>
        </div>
    `;

    // Container'ı sayfaya ekle
    $('.container').append(container);

    // Hoca ekleme butonuna tıklandığında
    $('#addLecturerBtn').on('click', function () {
        $('#addLecturerModal').modal('show');
    });

    // Hoca ekleme formunu gönder
    $('#submitLecturer').on('click', function () {
        const courseSection = $('#courseSection').val();
        const lecturerName = $('#lecturerName').val();

        if (!courseSection || !lecturerName) {
            alert('Lütfen tüm alanları doldurun!');
            return;
        }

        $.ajax({
            url: '/api/v1/plugins/lecturer/add',
            method: 'POST',
            data: {
                courseSection: courseSection,
                lecturerName: lecturerName
            },
            success: function (response) {
                if (response.success) {
                    $('#addLecturerModal').modal('hide');
                    loadLecturers(courseSection);
                } else {
                    alert(response.message || 'Bir hata oluştu!');
                }
            },
            error: function () {
                alert('Bir hata oluştu!');
            }
        });
    });

    // Hoca oylamayı işle
    $(document).on('click', '.vote-btn', function () {
        const courseSection = $(this).data('course');
        const lecturerName = $(this).data('lecturer');
        const voteType = $(this).data('vote');

        $.ajax({
            url: '/api/v1/plugins/lecturer/vote',
            method: 'POST',
            data: {
                courseSection: courseSection,
                lecturerName: lecturerName,
                voteType: voteType
            },
            success: function (response) {
                if (response.success) {
                    loadLecturers(courseSection);
                } else {
                    alert(response.message || 'Bir hata oluştu!');
                }
            },
            error: function () {
                alert('Bir hata oluştu!');
            }
        });
    });

    // Hocaları yükle
    function loadLecturers(courseSection) {
        $.ajax({
            url: `/api/v1/plugins/lecturer/list/${courseSection}`,
            method: 'GET',
            success: function (lecturers) {
                const container = $('.lecturer-list');
                container.empty();

                lecturers.forEach(function (lecturer) {
                    const lecturerHtml = `
                        <div class="card mb-3">
                            <div class="card-body">
                                <h5 class="card-title">${lecturer.name}</h5>
                                <p class="card-text">
                                    Ders: ${lecturer.courseSection}<br>
                                    Oy: ${lecturer.votes}
                                </p>
                                <button class="btn btn-success vote-btn" data-course="${lecturer.courseSection}" 
                                        data-lecturer="${lecturer.name}" data-vote="up">
                                    👍 Olumlu
                                </button>
                                <button class="btn btn-danger vote-btn" data-course="${lecturer.courseSection}" 
                                        data-lecturer="${lecturer.name}" data-vote="down">
                                    👎 Olumsuz
                                </button>
                            </div>
                        </div>
                    `;
                    container.append(lecturerHtml);
                });
            }
        });
    }
}); 