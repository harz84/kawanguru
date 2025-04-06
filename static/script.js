document.addEventListener('DOMContentLoaded', () => {
    // --- Referensi Elemen DOM ---
    const form = document.getElementById('question-generator-form');
    const generateBtn = document.getElementById('generate-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsSection = document.getElementById('results-section');
    const questionsPreview = document.getElementById('questions-preview');
    const errorMessage = document.getElementById('error-message');
    const exportBtn = document.getElementById('export-btn');
    const saveChangesBtn = document.getElementById('save-changes-btn');
    const fileInput = document.getElementById('module-file');

    // --- Variabel untuk menyimpan data soal yang ditampilkan (penting untuk edit) ---
    let displayedQuestionsData = [];

    // === FUNGSI HELPER BARU untuk Membersihkan Prefix Opsi ===
    /**
     * Menghapus prefix list umum (seperti 'a.', '1)', ' B.') dari awal string.
     * @param {string} text Teks opsi asli.
     * @returns {string} Teks opsi yang sudah dibersihkan.
     */
    function cleanOptionText(text) {
        if (typeof text !== 'string') return text; // Kembalikan jika bukan string
        // Regex: ^\s* : Awal string diikuti 0 atau lebih spasi
        //        [a-zA-Z0-9]+ : Satu atau lebih huruf/angka (untuk a, b, 1, 2, dll.)
        //        [.)] : Diikuti oleh titik atau kurung tutup
        //        \s* : Diikuti oleh 0 atau lebih spasi
        const prefixRegex = /^\s*[a-zA-Z0-9]+[.)]\s*/;
        return text.replace(prefixRegex, '').trim(); // Hapus prefix jika cocok dan trim spasi sisa
    }
    // ========================================================

    // --- Event Listener Utama untuk Form Submission ---
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Mencegah reload halaman

        if (!fileInput.files || fileInput.files.length === 0) {
            showError("Silakan pilih file modul terlebih dahulu.");
            return;
        }
        const selectedFile = fileInput.files[0];

        // Reset UI
        hideError();
        resultsSection.classList.add('hidden');
        questionsPreview.innerHTML = '';
        exportBtn.classList.add('hidden');
        saveChangesBtn.classList.add('hidden');
        displayedQuestionsData = []; // Kosongkan data lama
        loadingIndicator.classList.remove('hidden');
        generateBtn.disabled = true;
        generateBtn.textContent = 'Membuat Soal dengan AI...';

        const formData = new FormData();
        formData.append('moduleFile', selectedFile);
        formData.append('difficulty', document.getElementById('difficulty-level').value);
        formData.append('startPage', document.getElementById('start-page').value);
        formData.append('endPage', document.getElementById('end-page').value);
        formData.append('numQuestions', document.getElementById('num-questions').value);
        formData.append('questionType', document.getElementById('question-type').value);

        try {
            console.log("Mengirim FormData ke /generate-soal...");
            const response = await fetch('/generate-soal', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                let errorMsg = `Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || JSON.stringify(errorData);
                } catch (e) { /* ignore if error body isn't json */ }
                throw new Error(errorMsg);
            }

            const result = await response.json();
            console.log("Respons sukses dari backend:", result);

            // Proses Hasil dari Backend
            if (result.error) {
                showError(`Gagal di server: ${result.error}`);
            } else if (result.questions && Array.isArray(result.questions)) {
                hideError();
                alert(result.message || "Soal berhasil dibuat!");

                if (result.questions.length > 0) {
                    // Simpan data soal untuk digunakan saat edit
                    displayedQuestionsData = result.questions;
                    displayResults(displayedQuestionsData); // Tampilkan soal
                    resultsSection.classList.remove('hidden');
                    exportBtn.classList.remove('hidden');
                    saveChangesBtn.classList.remove('hidden');
                } else {
                    showError("Proses AI selesai, namun tidak ada soal yang dihasilkan.");
                }
            } else {
                 console.error("Format respons tidak terduga:", result);
                 showError("Gagal memproses respons server (format tidak dikenali).");
            }

        } catch (error) {
            console.error("Terjadi kesalahan:", error);
            showError(`Gagal: ${error.message}`);
        } finally {
            // Reset UI setelah selesai
            loadingIndicator.classList.add('hidden');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Buat Soal';
        }
    });

    // --- Fungsi untuk Menampilkan Hasil Soal ---
    function displayResults(questions) {
        questionsPreview.innerHTML = '';

        if (!questions || questions.length === 0) {
            questionsPreview.innerHTML = '<p>Tidak ada soal untuk ditampilkan.</p>';
            return;
        }

        questions.forEach((q, index) => {
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item');
            const uniqueId = q.id || `gen-${index}`;
            questionItem.setAttribute('data-question-id', uniqueId);

            // Kontainer Teks Pertanyaan
            const textContainer = document.createElement('div');
            textContainer.classList.add('question-text-container');
            textContainer.innerHTML = `<p class="question-text"><strong>${index + 1}.</strong> ${q.question_text || 'Teks soal tidak ditemukan.'}</p>`;
            questionItem.appendChild(textContainer);

            // Opsi Jawaban (jika Pilihan Ganda)
            if (q.question_type === 'pilihan_ganda' && q.options && Array.isArray(q.options) && q.options.length > 0) {
                const optionsDiv = document.createElement('div');
                optionsDiv.classList.add('question-options');
                const optionsList = document.createElement('ul');
                optionsList.classList.add('options-list');
                optionsList.style.listStyleType = 'none'; // Nonaktifkan bullet/number default
                optionsList.style.paddingLeft = '0'; // Reset padding kiri
                const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f'];

                q.options.forEach((opt, optIndex) => {
                    const li = document.createElement('li');
                    li.style.marginLeft = '20px'; // Beri indentasi manual
                    const letter = optionLetters[optIndex] || String.fromCharCode(97 + optIndex);
                    // **PERBAIKAN: Bersihkan teks opsi sebelum ditampilkan**
                    const cleanedOptText = cleanOptionText(opt);
                    li.innerHTML = `<span class="option-letter" style="margin-right: 5px;">${letter}.</span><span class="option-text">${cleanedOptText}</span>`;
                    optionsList.appendChild(li);
                });
                optionsDiv.appendChild(optionsList);

                // Tampilkan Jawaban Benar di bawah opsi
                if (q.correct_answer) {
                    // **PERBAIKAN: Bersihkan juga teks jawaban benar sebelum mencari index**
                    const cleanedCorrectAnswer = cleanOptionText(q.correct_answer);
                    // **PERBAIKAN: Cari index berdasarkan TEKS OPSI YANG SUDAH DIBERSIHKAN**
                    const correctOptionIndex = q.options.findIndex(opt => cleanOptionText(opt) === cleanedCorrectAnswer);

                    if (correctOptionIndex !== -1) {
                        const correctAnswerLetter = optionLetters[correctOptionIndex] || String.fromCharCode(97 + correctOptionIndex);
                        const answerDisplay = document.createElement('p');
                        answerDisplay.classList.add('correct-answer-display');
                        answerDisplay.style.marginLeft = '20px'; // Samakan indentasi
                        answerDisplay.innerHTML = `<i>Jawaban Benar: ${correctAnswerLetter}</i>`;
                        optionsDiv.appendChild(answerDisplay);
                    } else {
                         // Jika teks jawaban benar tidak cocok setelah dibersihkan
                         console.warn(`Jawaban benar "${q.correct_answer}" (setelah dibersihkan jadi "${cleanedCorrectAnswer}") tidak ditemukan di opsi soal ${index + 1}.`);
                         const answerDisplay = document.createElement('p');
                         answerDisplay.classList.add('correct-answer-display', 'warning');
                         answerDisplay.style.marginLeft = '20px'; // Samakan indentasi
                         // Tampilkan teks asli dari AI untuk debug jika tidak cocok
                         answerDisplay.innerHTML = `<i>Jawaban Benar (Teks Asli: ${q.correct_answer}) - Tidak cocok dengan opsi</i>`;
                         optionsDiv.appendChild(answerDisplay);
                    }
                }
                questionItem.appendChild(optionsDiv);
            }
            // Tampilkan jawaban tipe lain jika perlu
            else if (q.question_type === 'benar_salah' && q.correct_answer) {
                 const answerDiv = document.createElement('div');
                 answerDiv.classList.add('correct-answer-display');
                 answerDiv.innerHTML = `<p><small>Jawaban: ${q.correct_answer}</small></p>`;
                 questionItem.appendChild(answerDiv);
            }

            // Tombol Aksi
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('edit-actions');
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.onclick = () => toggleEditMode(questionItem);
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Hapus';
            deleteButton.classList.add('delete');
            deleteButton.onclick = () => {
                 if (confirm('Yakin ingin menghapus soal ini?')) {
                     const qId = questionItem.getAttribute('data-question-id');
                     // Hapus dari data array
                     displayedQuestionsData = displayedQuestionsData.filter((item, idx) => (item.id || `gen-${idx}`) !== qId);
                     // Hapus elemen dari DOM
                     questionItem.remove();
                     // Perbarui nomor urut jika perlu (opsional, bisa dilakukan saat save/export)
                     // displayResults(displayedQuestionsData); // Re-render semua atau update nomor secara manual
                 }
            };
            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            questionItem.appendChild(actionsDiv);

            questionsPreview.appendChild(questionItem);
        });
    }

     // --- Fungsi untuk Mengaktifkan/Menonaktifkan Mode Edit Soal ---
    function toggleEditMode(questionItem) {
        const questionId = questionItem.getAttribute('data-question-id');
        const questionDataIndex = displayedQuestionsData.findIndex((q, idx) => (q.id || `gen-${idx}`) === questionId);

        if (questionDataIndex === -1) {
            console.error("Data soal tidak ditemukan untuk ID:", questionId);
            alert("Gagal memulai edit: data soal tidak ditemukan.");
            return;
        }
        const questionData = displayedQuestionsData[questionDataIndex]; // Akses data untuk diupdate

        const textContainer = questionItem.querySelector('.question-text-container');
        const optionsDiv = questionItem.querySelector('.question-options');
        const editButton = questionItem.querySelector('.edit-actions button:not(.delete)');
        const isEditing = questionItem.classList.contains('is-editing');

        if (isEditing) {
            // --- KELUAR DARI MODE EDIT (SIMPAN PERUBAHAN LOKAL) ---
            const questionTextArea = textContainer.querySelector('textarea.edit-textarea');
            const newQuestionText = questionTextArea ? questionTextArea.value : questionData.question_text;

            const questionNumberStrong = textContainer.querySelector('strong'); // Simpan nomornya
            textContainer.innerHTML = `<p class="question-text">${questionNumberStrong ? questionNumberStrong.outerHTML : ''} ${newQuestionText}</p>`;

            // Update data pertanyaan di array utama
            displayedQuestionsData[questionDataIndex].question_text = newQuestionText;

            // Jika Pilihan Ganda, simpan opsi yang diedit
            if (questionData.question_type === 'pilihan_ganda' && optionsDiv) {
                const optionInputs = optionsDiv.querySelectorAll('input.edit-option-input');
                const optionsList = optionsDiv.querySelector('ul.options-list');
                const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f'];
                const newOptionsData = [];

                optionsList.innerHTML = ''; // Kosongkan list input

                optionInputs.forEach((input, index) => {
                     const editedOptionText = input.value; // Ambil teks dari input (sudah bersih)
                     newOptionsData.push(editedOptionText); // Simpan teks baru (bersih) ke data

                     // Buat ulang tampilan list item (li) dengan teks bersih
                     const li = document.createElement('li');
                     li.style.marginLeft = '20px'; // Beri indentasi manual
                     const letter = optionLetters[index] || String.fromCharCode(97 + index);
                     li.innerHTML = `<span class="option-letter" style="margin-right: 5px;">${letter}.</span><span class="option-text">${editedOptionText}</span>`; // Tampilkan teks bersih
                     optionsList.appendChild(li);
                });

                // Update data opsi di array utama
                displayedQuestionsData[questionDataIndex].options = newOptionsData;

                // Tampilkan kembali info jawaban benar (sesuaikan dengan data baru)
                 const answerDisplay = optionsDiv.querySelector('.correct-answer-display');
                 if (answerDisplay) {
                     // **PERBAIKAN: Gunakan teks jawaban benar yg bersih & cari di opsi baru yg bersih**
                     const cleanedCorrectAnswer = cleanOptionText(questionData.correct_answer); // Pastikan jawaban benar juga bersih
                     const correctOptionIndex = newOptionsData.findIndex(opt => opt === cleanedCorrectAnswer); // Cari di opsi BARU (yg sudah bersih)

                     if (correctOptionIndex !== -1) {
                        const correctAnswerLetter = optionLetters[correctOptionIndex] || String.fromCharCode(97 + correctOptionIndex);
                        answerDisplay.innerHTML = `<i>Jawaban Benar: ${correctAnswerLetter}</i>`;
                     } else {
                        // Jika tetap tidak ketemu setelah diedit & dibersihkan
                        answerDisplay.innerHTML = `<i>Jawaban Benar (Teks Asli: ${questionData.correct_answer}) - Tidak cocok dengan opsi</i>`;
                     }
                     answerDisplay.style.display = ''; // Tampilkan lagi
                     answerDisplay.style.marginLeft = '20px'; // Atur indentasi lagi
                 }
            }

            editButton.textContent = 'Edit';
            questionItem.classList.remove('is-editing');
            console.log("Data Soal Diperbarui (di memori):", displayedQuestionsData[questionDataIndex]);

        } else {
            // --- MASUK KE MODE EDIT ---
            const questionNumberStrong = textContainer.querySelector('.question-text strong'); // Ambil nomor
            const currentQuestionText = questionData.question_text; // Ambil teks dari data

            textContainer.innerHTML = `
                ${questionNumberStrong ? questionNumberStrong.outerHTML : ''}
                <textarea class="edit-textarea" style="width: 98%; min-height: 60px; margin-top: 5px;">${currentQuestionText}</textarea>
            `;

            // Jika Pilihan Ganda, buat opsi jadi input
            if (questionData.question_type === 'pilihan_ganda' && optionsDiv) {
                const optionsList = optionsDiv.querySelector('ul.options-list');
                optionsList.innerHTML = ''; // Kosongkan list tampilan

                // Ambil data opsi dari array questionData
                (questionData.options || []).forEach((optText, index) => {
                    const letter = ['a', 'b', 'c', 'd', 'e', 'f'][index] || String.fromCharCode(97 + index);

                    const inputLi = document.createElement('li');
                    inputLi.style.listStyle = 'none';
                    inputLi.style.marginLeft = '20px'; // Indentasi
                    inputLi.style.marginBottom = '5px'; // Jarak antar input

                    const input = document.createElement('input');
                    input.type = 'text';
                    // **PERBAIKAN: Gunakan cleanOptionText saat mengisi value input**
                    input.value = cleanOptionText(optText); // Isi input dengan teks bersih
                    input.classList.add('edit-option-input');
                    input.style.width = 'calc(95% - 30px)'; // Sesuaikan lebar
                    input.style.padding = '5px';
                    input.style.marginLeft = '5px'; // Jarak dari abjad

                    inputLi.innerHTML = `<span class="option-letter">${letter}.</span>`;
                    inputLi.appendChild(input);
                    optionsList.appendChild(inputLi);
                });

                 // Sembunyikan info jawaban benar selama edit
                 const answerDisplay = optionsDiv.querySelector('.correct-answer-display');
                 if (answerDisplay) answerDisplay.style.display = 'none';
            }

            const textarea = textContainer.querySelector('textarea.edit-textarea');
            if(textarea) textarea.focus();
            editButton.textContent = 'Simpan';
            questionItem.classList.add('is-editing');
        }
    }

    // --- Fungsi Utilitas Error ---
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }
    function hideError() {
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
    }

    // --- Event Listener Tombol Aksi (Export & Save Placeholder) ---
    exportBtn.addEventListener('click', () => {
        if (!displayedQuestionsData || displayedQuestionsData.length === 0) {
            alert('Tidak ada soal untuk diekspor.');
            return;
        }
        let txtContent = "Daftar Soal (Generated by Kawanguru)\n";
        txtContent += "=========================================\n\n";
        const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f'];

        displayedQuestionsData.forEach((question, index) => {
            // Ambil teks pertanyaan dari data (mungkin sudah diedit)
            txtContent += `${index + 1}. ${question.question_text}\n`;
            if (question.question_type === 'pilihan_ganda' && question.options && question.options.length > 0) {
                question.options.forEach((opt, optIndex) => {
                    const letter = optionLetters[optIndex] || String.fromCharCode(97 + optIndex);
                    // **PERBAIKAN: Pastikan ekspor juga pakai teks bersih**
                    // Karena data di displayedQuestionsData sudah bersih setelah edit,
                    // kita bisa langsung pakai 'opt'. Jika tidak yakin, gunakan cleanOptionText(opt)
                    txtContent += `   ${letter}. ${opt}\n`; // Asumsi 'opt' di data sudah bersih
                });
                 // **PERBAIKAN: Cari jawaban benar pakai teks bersih**
                 const cleanedCorrectAnswer = cleanOptionText(question.correct_answer);
                 const correctOptionIndex = question.options.findIndex(opt => opt === cleanedCorrectAnswer); // Bandingkan dengan opsi bersih di data

                 let correctAnswerInfo = "Jawaban Benar: (Tidak ditentukan atau tidak cocok)";
                 if (correctOptionIndex !== -1) {
                     correctAnswerInfo = `Jawaban Benar: ${optionLetters[correctOptionIndex] || String.fromCharCode(97 + correctOptionIndex)}`;
                 } else if (question.correct_answer){
                     // Fallback jika tidak cocok, tampilkan teks asli
                     correctAnswerInfo = `Jawaban Benar (Teks Asli): ${question.correct_answer}`;
                 }
                txtContent += `   ${correctAnswerInfo}\n`;
            } else if (question.question_type === 'benar_salah' && question.correct_answer) {
                txtContent += `   Jawaban: ${question.correct_answer}\n`;
            }
            txtContent += "\n\n"; // Tambah baris kosong antar soal
        });

        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        link.download = `kawanguru_soal_${timestamp}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log("Soal berhasil diekspor ke file TXT.");
    });

    saveChangesBtn.addEventListener('click', () => {
        // Placeholder: Di sini Anda bisa mengirim 'displayedQuestionsData' ke server
        alert('Fungsi Simpan Perubahan (ke server) belum diimplementasikan.\nData soal yang tersimpan di memori (termasuk editan):\n' + JSON.stringify(displayedQuestionsData, null, 2));
        console.log("Data siap dikirim:", displayedQuestionsData);
    });

}); // Akhir dari DOMContentLoaded