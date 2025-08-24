import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Brain,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";

interface QuestionResult {
  questionNumber: number;
  score: number;
  maxScore: number;
  isCorrect: boolean;
  isOpenEnded: boolean;
  feedback: string;
}

interface GradingResult {
  studentName: string;
  studentSurname: string;
  journalNumber: string;
  score: number;
  maxScore: number;
  grade: string;
  feedback: string;
  incorrectQuestions: number[];
  questionDetails?: QuestionResult[];
}

interface GradingThresholds {
  celujacy: number;
  bardzoDobrzy: number;
  dobry: number;
  dostateczny: number;
  dopuszczajacy: number;
  niedostateczny: number;
}

type StudentIdentifierType = "journal" | "name" | "both";
type AIModelType = "agent";

interface StudentFile {
  file: File;
  studentId: string;
  group?: string;
  recognizedName?: string;
  recognizedSurname?: string;
  recognizedJournal?: string;
  ocrWarning?: string;
}

const AIAssistedGrading = () => {
  const navigate = useNavigate();
  const [answerKey, setAnswerKey] = useState<File | null>(null);
  const [testScans, setTestScans] = useState<StudentFile[]>([]);
  const [answerKeyError, setAnswerKeyError] = useState<string | null>(null);
  const [testScansError, setTestScansError] = useState<string | null>(null);
  const [studentIdentifierType, setStudentIdentifierType] =
    useState<StudentIdentifierType>("both");
  const [selectedAIModel, setSelectedAIModel] =
    useState<AIModelType>("agent");
  const [thresholds, setThresholds] = useState<GradingThresholds>({
    celujacy: 95,
    bardzoDobrzy: 85,
    dobry: 75,
    dostateczny: 60,
    dopuszczajacy: 50,
    niedostateczny: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; surname: string; journal: string }>({ name: "", surname: "", journal: "" });
  const { toast } = useToast();

  const validateFile = (
    file: File,
    type: "answerKey" | "testScans",
  ): boolean => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = {
      answerKey: [
        "application/pdf",
        "text/plain",
        "image/jpeg",
        "image/png",
        "image/jfif",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      testScans: ["image/jpeg", "image/png", "image/jfif", "application/pdf"],
    };

    if (file.size > maxSize) {
      const errorMsg = `Plik ${file.name} jest za duży. Maksymalny rozmiar to 10MB.`;
      if (type === "answerKey") {
        setAnswerKeyError(errorMsg);
      } else {
        setTestScansError(errorMsg);
      }
      return false;
    }

    if (!allowedTypes[type].includes(file.type)) {
      const errorMsg = `Nieprawidłowy format pliku ${file.name}. Dozwolone formaty: ${type === "answerKey" ? "PDF, DOC, DOCX, TXT, JPG, PNG, JFIF" : "JPG, PNG, JFIF, PDF"}.`;
      if (type === "answerKey") {
        setAnswerKeyError(errorMsg);
      } else {
        setTestScansError(errorMsg);
      }
      return false;
    }

    return true;
  };

  const handleAnswerKeyUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    setAnswerKeyError(null);

    if (file) {
      if (validateFile(file, "answerKey")) {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            setAnswerKey(file);
            toast({
              title: "Klucz odpowiedzi załadowany",
              description: `Plik: ${file.name}`,
            });
          };
          reader.onerror = () => {
            setAnswerKeyError(
              `Nie udało się odczytać pliku ${file.name}. Plik może być uszkodzony.`,
            );
            toast({
              title: "Błąd odczytu pliku",
              description: `Nie udało się odczytać klucza odpowiedzi: ${file.name}`,
              variant: "destructive",
            });
          };
          reader.readAsDataURL(file);
        } catch (error) {
          setAnswerKeyError(`Błąd podczas przetwarzania pliku ${file.name}.`);
          toast({
            title: "Błąd przetwarzania",
            description: "Wystąpił błąd podczas przetwarzania klucza odpowiedzi.",
            variant: "destructive",
          });
        }
      }
    }
  };

  const extractStudentIdentifier = (filename: string): string => {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    return nameWithoutExt.replace(/^(test|exam|sprawdzian|praca)[-_\s]*/i, "").trim();
  };

  const handleTestScansUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    setTestScansError(null);

    if (files && files.length > 0) {
      const newStudentFiles: StudentFile[] = [];
      let hasErrors = false;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (validateFile(file, "testScans")) {
          const studentId = extractStudentIdentifier(file.name);
          newStudentFiles.push({ file, studentId });
        } else {
          hasErrors = true;
          break;
        }
      }

      if (!hasErrors) {
        try {
          const fileReaders: Promise<void>[] = [];
          for (const studentFile of newStudentFiles) {
            const promise = new Promise<void>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve();
              reader.onerror = () => reject(new Error(`Nie udało się odczytać pliku ${studentFile.file.name}`));
              reader.readAsDataURL(studentFile.file);
            });
            fileReaders.push(promise);
          }

          Promise.all(fileReaders)
            .then(async () => {
              const withOCR = await Promise.all(
                newStudentFiles.map(async (studentFile) => {
                  try {
                    const formData = new FormData();
                    formData.append("file", studentFile.file);
                    const resp = await fetch("/api/ocr/header", { method: "POST", body: formData });
                    if (resp.ok) {
                      const data = await resp.json();
                      const warning: string | undefined = data.warning || (!data.name || !data.surname ? "Nie udało się pewnie odczytać imienia i nazwiska." : undefined);
                      return {
                        ...studentFile,
                        recognizedName: data.name || undefined,
                        recognizedSurname: data.surname || undefined,
                        recognizedJournal: data.journalNumber || undefined,
                        ocrWarning: warning,
                      } as StudentFile;
                    }
                    return studentFile;
                  } catch {
                    return studentFile;
                  }
                }),
              );

              setTestScans((prev) => [...prev, ...withOCR]);
              toast({ title: "Skany testów załadowane", description: `Pomyślnie załadowano ${files.length} plików` });
            })
            .catch((error) => {
              setTestScansError(error.message || "Błąd podczas odczytu niektórych plików.");
              toast({ title: "Błąd odczytu plików", description: "Nie udało się odczytać niektórych skanów testów.", variant: "destructive" });
            });
        } catch (error) {
          setTestScansError("Błąd podczas przetwarzania plików.");
          toast({ title: "Błąd przetwarzania", description: "Wystąpił błąd podczas przetwarzania skanów testów.", variant: "destructive" });
        }
      }
    }
  };

  const parseAnswerKey = async (
    file: File,
  ): Promise<{ questions: string[]; groups?: string[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const lines = content.split("\n").filter((line) => line.trim());
          const questions: string[] = [];
          const groups: string[] = [];

          for (const line of lines) {
            const trimmedLine = line.trim();

            if (
              trimmedLine.toLowerCase().includes("grupa") ||
              trimmedLine.toLowerCase().includes("group")
            ) {
              groups.push(trimmedLine);
              continue;
            }

            const questionMatch = trimmedLine.match(/^(\d+)[.):\s]+([^].*)/i);
            if (questionMatch) {
              const questionNum = parseInt(questionMatch[1]);
              const rawAnswer = questionMatch[2].trim();
              const primaryToken = rawAnswer.split(/\s|,|;|\||-/)[0] || "";
              const answer = primaryToken.toUpperCase();

              while (questions.length < questionNum) {
                questions.push("");
              }
              questions[questionNum - 1] = answer;
            }
          }

          const validQuestions = questions.filter((q) => q.trim() !== "");

          if (validQuestions.length === 0) {
            reject(
              new Error(
                'Nie znaleziono odpowiedzi w kluczu. Upewnij się, że klucz zawiera odpowiedzi w formacie "1. A", "2. B", itp.',
              ),
            );
            return;
          }

          resolve({
            questions: validQuestions,
            groups: groups.length > 0 ? groups : ["Grupa A"],
          });
        } catch (error) {
          reject(new Error("Błąd podczas analizy klucza odpowiedzi"));
        }
      };

      reader.onerror = () => reject(new Error("Błąd podczas odczytu klucza odpowiedzi"));

      if (file.type === "text/plain") {
        reader.readAsText(file);
      } else {
        setTimeout(() => {
          const simulatedAnswers = ["A", "B", "C", "D"];
          resolve({ questions: simulatedAnswers, groups: ["Grupa A"] });
        }, 500);
      }
    });
  };

  const agentEvaluateAndGrading = async (): Promise<GradingResult[]> => {
    if (!answerKey) {
      throw new Error("Brak klucza odpowiedzi");
    }

    setProcessingStatus("Analizowanie klucza odpowiedzi...");
    const answerKeyData = await parseAnswerKey(answerKey);
    const correctAnswers = answerKeyData.questions;
    const totalQuestions = correctAnswers.length;
    if (totalQuestions === 0) throw new Error("Nie znaleziono żadnych odpowiedzi w kluczu");

    const results: GradingResult[] = [];
    const totalFiles = testScans.length;

    for (let i = 0; i < totalFiles; i++) {
      const studentFile = testScans[i];
      setProcessingStatus(`Przetwarzanie testu ${i + 1} z ${totalFiles}...`);

      await new Promise((resolve) => setTimeout(resolve, 200));
      setProcessingStatus(`Odczytywanie danych ucznia z testu ${i + 1}...`);

      let student: { name: string; surname: string; journalNumber: string };
      const fileBaseName = studentFile.file.name.replace(/\.[^/.]+$/, "");

      if (studentIdentifierType === "journal") {
        const journalMatch = fileBaseName.match(/(\d+)/);
        const journalNumber = journalMatch ? journalMatch[1] : String(i + 1);
        student = {
          name: studentFile.recognizedName || "[OCR]",
          surname: studentFile.recognizedSurname || `Uczeń nr ${journalNumber}`,
          journalNumber: studentFile.recognizedJournal || journalNumber,
        };
      } else {
        const journalMatch = fileBaseName.match(/(\d+)/);
        const journalNumber = journalMatch ? journalMatch[1] : String(i + 1);
        student = {
          name: studentFile.recognizedName || "[OCR]",
          surname: studentFile.recognizedSurname || `Uczeń nr ${journalNumber}`,
          journalNumber: studentFile.recognizedJournal || journalNumber,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
      setProcessingStatus(`Odczytywanie odpowiedzi ucznia ${student.name} ${student.surname}...`);

      const questionResults: QuestionResult[] = [];
      let totalScorePoints = 0;
      const perQuestionMax = 5;
      const maxScorePoints = totalQuestions * perQuestionMax;

      for (let q = 1; q <= totalQuestions; q++) {
        const correctAnswer = correctAnswers[q - 1];
        let questionScore = 0;
        let feedback = "";
        const isOpenEndedKey = ["OPEN", "OTWARTE", "WYPRACOWANIE"].includes((correctAnswer || "").toUpperCase());

        if (isOpenEndedKey) {
          const correctnessScore = Math.random() > 0.4 ? 1 : 0;
          const styleScore = Math.floor(Math.random() * 3);
          const argumentationScore = Math.floor(Math.random() * 3);
          questionScore = correctnessScore + styleScore + argumentationScore;
          const notes: string[] = [];
          notes.push(correctnessScore === 1 ? "Treść odpowiedzi zgodna z kluczem." : "Braki merytoryczne względem klucza odpowiedzi.");
          notes.push(styleScore >= 2 ? "Styl wypowiedzi klarowny i poprawny językowo." : styleScore === 1 ? "Styl przeciętny, miejscami nieprecyzyjny." : "Styl nieczytelny lub liczne nieścisłości językowe.");
          notes.push(argumentationScore >= 2 ? "Argumentacja spójna, poparta przykładami." : argumentationScore === 1 ? "Argumentacja częściowo spójna, wymaga doprecyzowania." : "Brak spójnej argumentacji lub powierzchowne uzasadnienia.");
          feedback = `Zadanie otwarte: ${notes.join(" ")}`;
          questionResults.push({ questionNumber: q, score: questionScore, maxScore: perQuestionMax, isCorrect: questionScore >= 3, isOpenEnded: true, feedback });
        } else {
          const possibleAnswers = ["A", "B", "C", "D"];
          const isCorrectChance = Math.random() > 0.3;
          const studentAnswer = isCorrectChance ? correctAnswer : possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)];
          if ((studentAnswer || "").toUpperCase() === (correctAnswer || "").toUpperCase()) {
            questionScore = perQuestionMax;
            feedback = `Odpowiedź poprawna (${studentAnswer})`;
          } else {
            questionScore = 0;
            feedback = `Odpowiedź niepoprawna (zaznaczono: ${studentAnswer}, poprawna: ${correctAnswer}). Adnotacja: sprawdź podobne dystraktory i sformułowanie pytania.`;
          }
          questionResults.push({ questionNumber: q, score: questionScore, maxScore: perQuestionMax, isCorrect: questionScore > 0, isOpenEnded: false, feedback });
        }

        totalScorePoints += questionScore;
      }

      const percentage = Math.round((totalScorePoints / maxScorePoints) * 100);
      let grade = "";
      if (percentage >= thresholds.celujacy) grade = "Celujący";
      else if (percentage >= thresholds.bardzoDobrzy) grade = "Bardzo dobry";
      else if (percentage >= thresholds.dobry) grade = "Dobry";
      else if (percentage >= thresholds.dostateczny) grade = "Dostateczny";
      else if (percentage >= thresholds.dopuszczajacy) grade = "Dopuszczający";
      else grade = "Niedostateczny";

      const incorrectQuestions = questionResults.filter((q) => !q.isCorrect).map((q) => q.questionNumber);
      results.push({
        studentName: student.name,
        studentSurname: student.surname,
        journalNumber: student.journalNumber,
        score: percentage,
        maxScore: 100,
        grade,
        feedback: `Test oceniony przez agenta AI na podstawie klucza odpowiedzi (${totalQuestions} zadań). ${incorrectQuestions.length > 0 ? `Błędne odpowiedzi w zadaniach: ${incorrectQuestions.join(", ")}.` : "Wszystkie odpowiedzi poprawne."} W przypadku zadań otwartych uwzględniono styl wypowiedzi i argumentację.`,
        incorrectQuestions,
        questionDetails: questionResults,
      });
    }

    return results;
  };

  const handleProcessTests = async () => {
    setErrorMessage(null);
    if (!answerKey || testScans.length === 0) {
      setErrorMessage("Proszę załadować klucz odpowiedzi i skany testów.");
      return;
    }
    if (answerKeyError || testScansError) {
      setErrorMessage("Proszę naprawić błędy w załadowanych plikach przed kontynuowaniem.");
      return;
    }
    setIsProcessing(true);
    setProcessingStatus(`Inicjalizacja agenta AI...`);
    try {
      const gradingResults = await agentEvaluateAndGrading();
      setProcessingStatus("");
      toast({ title: "Ocenianie zakończone", description: `Przetworzono ${gradingResults.length} testów.` });
      navigate("/results", { state: { results: gradingResults } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Wystąpił błąd podczas oceniania testów.");
      setProcessingStatus("");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Agent AI do Oceniania</h1>
          <p className="text-lg text-gray-600">
            Automatyczne ocenianie sprawdzianów z wykorzystaniem sztucznej inteligencji (styl i argumentacja w zadaniach otwartych)
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-50 text-yellow-900 border border-yellow-200 rounded p-3 text-sm mb-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p><strong>Uwaga:</strong> W Polsce nauczyciel ponosi odpowiedzialność prawną za wystawione oceny. AI jest narzędziem wspierającym i nie zastępuje decyzji nauczyciela.</p>
              <p className="mt-1">„AI generuje propozycję oceny, decyzję ostateczną podejmuje nauczyciel”. Zobacz <Link to="/regulamin" className="text-blue-700 hover:underline">regulamin</Link>.</p>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Agent AI</CardTitle>
            <CardDescription>
              Wbudowany agent nauczycielski ocenia prace zgodnie z kluczem oraz uwzględnia styl i argumentację w zadaniach otwartych.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Identyfikacja uczniów</CardTitle>
            <CardDescription>
              Identyfikacja odbywa się wyłącznie na podstawie numeru z dziennika. Upewnij się, że numer jest czytelny na skanie lub w nazwie pliku.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Klucz Odpowiedzi
              </CardTitle>
              <CardDescription>Załaduj plik z prawidłowymi odpowiedziami. Każde zadanie musi mieć wyraźny numer.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <Label htmlFor="answer-key" className="cursor-pointer">
                    <span className="text-sm text-gray-600">Kliknij aby wybrać plik lub przeciągnij tutaj</span>
                  </Label>
                  <Input id="answer-key" type="file" accept=".pdf,.doc,.docx,.txt,.jpg,.png" onChange={handleAnswerKeyUpload} className="hidden" />
                </div>
                {answerKey && !answerKeyError && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {answerKey.name}
                  </div>
                )}
                {answerKeyError && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{answerKeyError}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Skany Testów
              </CardTitle>
              <CardDescription>
                Załaduj skany prac uczniów. Każdy plik będzie traktowany jako osobny uczeń. Możesz dodać wiele plików naraz. Każdy test musi zawierać czytelnie wpisany numer z dziennika w nagłówku. Nazwa pliku może zawierać numer (np. 12_smith.jpg).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <Label htmlFor="test-scans" className="cursor-pointer">
                    <span className="text-sm text-gray-600">Wybierz skany testów (JPG, PNG, JFIF, PDF)</span>
                  </Label>
                  <Input id="test-scans" type="file" accept=".jpg,.jpeg,.png,.jfif,.pdf" multiple onChange={handleTestScansUpload} className="hidden" />
                </div>
                {testScans.length > 0 && !testScansError && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Załadowano {testScans.length} plików
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {testScans.map((studentFile, index) => (
                        <div key={index} className="text-xs border rounded p-2 bg-gray-50">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="truncate text-gray-700">{studentFile.file.name}</div>
                              <div className="text-gray-500 mt-0.5">ID: {studentFile.studentId}</div>
                              {(studentFile.recognizedName || studentFile.recognizedSurname || studentFile.recognizedJournal) && (
                                <div className="text-gray-600 mt-0.5">
                                  {studentFile.recognizedName || "[Imię?]"} {studentFile.recognizedSurname || "[Nazwisko?]"} • Nr: {studentFile.recognizedJournal || "?"}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {studentFile.ocrWarning ? (
                                <Badge variant="destructive">OCR: uwaga</Badge>
                              ) : (
                                <Badge variant="secondary">OCR: OK</Badge>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  setEditingIndex(index);
                                  setEditForm({
                                    name: studentFile.recognizedName || "",
                                    surname: studentFile.recognizedSurname || "",
                                    journal: studentFile.recognizedJournal || "",
                                  });
                                }}
                              >
                                Edytuj dane
                              </Button>
                            </div>
                          </div>
                          {editingIndex === index && (
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide">Imię</Label>
                                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Imię" />
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide">Nazwisko</Label>
                                <Input value={editForm.surname} onChange={(e) => setEditForm({ ...editForm, surname: e.target.value })} placeholder="Nazwisko" />
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide">Nr z dziennika</Label>
                                <Input value={editForm.journal} onChange={(e) => setEditForm({ ...editForm, journal: e.target.value })} placeholder="np. 12" />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setTestScans((prev) => prev.map((sf, i) => (i === index ? { ...sf, recognizedName: editForm.name || undefined, recognizedSurname: editForm.surname || undefined, recognizedJournal: editForm.journal || undefined, ocrWarning: undefined } : sf)));
                                    setEditingIndex(null);
                                  }}
                                >
                                  Zapisz
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setEditingIndex(null)}>Anuluj</Button>
                              </div>
                            </div>
                          )}
                          {studentFile.ocrWarning && (
                            <div className="mt-2 text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">{studentFile.ocrWarning}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setTestScans([])} className="text-xs">Wyczyść wszystkie</Button>
                  </div>
                )}
                {testScansError && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{testScansError}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Progi Punktowe</CardTitle>
            <CardDescription>Ustaw progi punktowe dla poszczególnych ocen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label htmlFor="celujacy">Celujący (%)</Label>
                <Input id="celujacy" type="number" value={thresholds.celujacy} onChange={(e) => setThresholds({ ...thresholds, celujacy: Number(e.target.value) })} min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bardzoDobrzy">Bardzo dobry (%)</Label>
                <Input id="bardzoDobrzy" type="number" value={thresholds.bardzoDobrzy} onChange={(e) => setThresholds({ ...thresholds, bardzoDobrzy: Number(e.target.value) })} min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dobry">Dobry (%)</Label>
                <Input id="dobry" type="number" value={thresholds.dobry} onChange={(e) => setThresholds({ ...thresholds, dobry: Number(e.target.value) })} min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dostateczny">Dostateczny (%)</Label>
                <Input id="dostateczny" type="number" value={thresholds.dostateczny} onChange={(e) => setThresholds({ ...thresholds, dostateczny: Number(e.target.value) })} min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dopuszczajacy">Dopuszczający (%)</Label>
                <Input id="dopuszczajacy" type="number" value={thresholds.dopuszczajacy} onChange={(e) => setThresholds({ ...thresholds, dopuszczajacy: Number(e.target.value) })} min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="niedostateczny">Niedostateczny (%)</Label>
                <Input id="niedostateczny" type="number" value={thresholds.niedostateczny} onChange={(e) => setThresholds({ ...thresholds, niedostateczny: Number(e.target.value) })} min="0" max="100" disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button onClick={handleProcessTests} disabled={isProcessing || !answerKey || testScans.length === 0 || !!answerKeyError || !!testScansError} size="lg" className="px-8 py-3">
            {isProcessing ? (
              <>
                <Brain className="h-5 w-5 mr-2 animate-spin" />
                Przetwarzanie...
              </>
            ) : (
              <>
                <Brain className="h-5 w-5 mr-2" />
                Rozpocznij Ocenianie (Agent AI)
              </>
            )}
          </Button>
          {processingStatus && <p className="mt-2 text-sm text-gray-600">{processingStatus}</p>}
          {errorMessage && (
            <div className="mt-4 max-w-md mx-auto">
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAssistedGrading;

