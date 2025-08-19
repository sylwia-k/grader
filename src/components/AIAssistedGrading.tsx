import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
type AIModelType = "gpt-4" | "claude-3" | "gemini-pro" | "simulation";

interface StudentFile {
  file: File;
  studentId: string;
  group?: string;
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
    useState<AIModelType>("simulation");
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
          // Simulate file reading validation
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
            description:
              "Wystąpił błąd podczas przetwarzania klucza odpowiedzi.",
            variant: "destructive",
          });
        }
      }
    }
  };

  const extractStudentIdentifier = (filename: string): string => {
    // Extract potential student identifier from filename
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    // Remove common prefixes and clean up
    return nameWithoutExt
      .replace(/^(test|exam|sprawdzian|praca)[-_\s]*/i, "")
      .trim();
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
          newStudentFiles.push({
            file,
            studentId,
          });
        } else {
          hasErrors = true;
          break;
        }
      }

      if (!hasErrors) {
        try {
          // Simulate reading all files
          const fileReaders: Promise<void>[] = [];

          for (const studentFile of newStudentFiles) {
            const promise = new Promise<void>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                resolve();
              };
              reader.onerror = () => {
                reject(
                  new Error(
                    `Nie udało się odczytać pliku ${studentFile.file.name}`,
                  ),
                );
              };
              reader.readAsDataURL(studentFile.file);
            });
            fileReaders.push(promise);
          }

          Promise.all(fileReaders)
            .then(() => {
              setTestScans((prev) => [...prev, ...newStudentFiles]);
              toast({
                title: "Skany testów załadowane",
                description: `Pomyślnie załadowano ${files.length} plików`,
              });
            })
            .catch((error) => {
              setTestScansError(
                error.message || "Błąd podczas odczytu niektórych plików.",
              );
              toast({
                title: "Błąd odczytu plików",
                description: "Nie udało się odczytać niektórych skanów testów.",
                variant: "destructive",
              });
            });
        } catch (error) {
          setTestScansError("Błąd podczas przetwarzania plików.");
          toast({
            title: "Błąd przetwarzania",
            description: "Wystąpił błąd podczas przetwarzania skanów testów.",
            variant: "destructive",
          });
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

          // Parse answer key content
          const lines = content.split("\n").filter((line) => line.trim());
          const questions: string[] = [];
          const groups: string[] = [];

          // Look for answer patterns like "1. A", "2. B", etc.
          for (const line of lines) {
            const trimmedLine = line.trim();

            // Check for group indicators
            if (
              trimmedLine.toLowerCase().includes("grupa") ||
              trimmedLine.toLowerCase().includes("group")
            ) {
              groups.push(trimmedLine);
              continue;
            }

            // Match question patterns: "1. A", "1) B", "1: C", etc.
            const questionMatch = trimmedLine.match(
              /^(\d+)[.):\s]+([A-Za-z0-9]+)/i,
            );
            if (questionMatch) {
              const questionNum = parseInt(questionMatch[1]);
              const answer = questionMatch[2].toUpperCase();

              // Ensure we have the right index
              while (questions.length < questionNum) {
                questions.push("");
              }
              questions[questionNum - 1] = answer;
            }
          }

          // Filter out empty answers
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

      reader.onerror = () =>
        reject(new Error("Błąd podczas odczytu klucza odpowiedzi"));

      if (file.type === "text/plain") {
        reader.readAsText(file);
      } else {
        // For other file types, simulate OCR reading
        // In real implementation, this would use OCR
        setTimeout(() => {
          // Simulate reading answer key from image/PDF
          const simulatedAnswers = ["A", "B", "C", "D"]; // Default 4 questions
          resolve({ questions: simulatedAnswers, groups: ["Grupa A"] });
        }, 500);
      }
    });
  };

  const simulateOCRAndGrading = async (): Promise<GradingResult[]> => {
    if (!answerKey) {
      throw new Error("Brak klucza odpowiedzi");
    }

    // Parse the answer key first
    setProcessingStatus("Analizowanie klucza odpowiedzi...");
    const answerKeyData = await parseAnswerKey(answerKey);
    const correctAnswers = answerKeyData.questions;
    const totalQuestions = correctAnswers.length;

    if (totalQuestions === 0) {
      throw new Error("Nie znaleziono żadnych odpowiedzi w kluczu");
    }

    const mockResults: GradingResult[] = [];
    const totalFiles = testScans.length;

    for (let i = 0; i < totalFiles; i++) {
      const studentFile = testScans[i];
      setProcessingStatus(`Przetwarzanie testu ${i + 1} z ${totalFiles}...`);

      // Simulate OCR reading student data from the actual test image
      await new Promise((resolve) => setTimeout(resolve, 800));
      setProcessingStatus(`Odczytywanie danych ucznia z testu ${i + 1}...`);

      // Simulate reading student data from the test image
      let student;
      const fileBaseName = studentFile.file.name.replace(/\.[^/.]+$/, "");

      // Try to extract student info from filename or simulate OCR
      if (studentIdentifierType === "journal") {
        const journalMatch = fileBaseName.match(/(\d+)/);
        const journalNumber = journalMatch ? journalMatch[1] : String(i + 1);
        student = {
          name: "[OCR]",
          surname: `Uczeń nr ${journalNumber}`,
          journalNumber: journalNumber,
        };
      } else if (studentIdentifierType === "name") {
        // Try to extract name from filename
        const cleanName = fileBaseName.replace(/[_-]/g, " ").trim();
        const nameParts = cleanName.split(" ");
        student = {
          name: nameParts[0] || `Uczeń${i + 1}`,
          surname: nameParts[1] || `Nazwisko${i + 1}`,
          journalNumber: String(i + 1),
        };
      } else {
        // Both name and journal number
        const journalMatch = fileBaseName.match(/(\d+)/);
        const journalNumber = journalMatch ? journalMatch[1] : String(i + 1);
        const cleanName = fileBaseName
          .replace(/\d+/g, "")
          .replace(/[_-]/g, " ")
          .trim();
        const nameParts = cleanName
          .split(" ")
          .filter((part) => part.length > 0);

        student = {
          name: nameParts[0] || `Uczeń${i + 1}`,
          surname: nameParts[1] || `Nazwisko${i + 1}`,
          journalNumber: journalNumber,
        };
      }

      // Simulate reading answers from the test
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setProcessingStatus(
        `Odczytywanie odpowiedzi ucznia ${student.name} ${student.surname}...`,
      );

      const questionResults = [];
      let totalScore = 0;
      const maxScore = totalQuestions * 5; // 5 points per question

      // Grade each question based on the answer key
      for (let q = 1; q <= totalQuestions; q++) {
        const correctAnswer = correctAnswers[q - 1];
        let questionScore = 0;
        let feedback = "";

        // Simulate reading student's answer from the test image
        // In reality, this would use OCR to read the marked answer
        const possibleAnswers = ["A", "B", "C", "D"];
        const isCorrectChance = Math.random() > 0.3; // 70% chance of correct answer
        const studentAnswer = isCorrectChance
          ? correctAnswer
          : possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)];

        // Compare with answer key
        if (studentAnswer.toUpperCase() === correctAnswer.toUpperCase()) {
          questionScore = 5;
          feedback = `Odpowiedź poprawna (${studentAnswer})`;
        } else {
          questionScore = 0;
          feedback = `Odpowiedź niepoprawna (zaznaczono: ${studentAnswer}, poprawna: ${correctAnswer})`;
        }

        questionResults.push({
          questionNumber: q,
          score: questionScore,
          maxScore: 5,
          isCorrect: questionScore > 0,
          isOpenEnded: false,
          feedback: feedback,
        });

        totalScore += questionScore;
      }

      const percentage = Math.round((totalScore / maxScore) * 100);
      let grade = "";

      if (percentage >= thresholds.celujacy) grade = "Celujący";
      else if (percentage >= thresholds.bardzoDobrzy) grade = "Bardzo dobry";
      else if (percentage >= thresholds.dobry) grade = "Dobry";
      else if (percentage >= thresholds.dostateczny) grade = "Dostateczny";
      else if (percentage >= thresholds.dopuszczajacy) grade = "Dopuszczający";
      else grade = "Niedostateczny";

      const incorrectQuestions = questionResults
        .filter((q) => !q.isCorrect)
        .map((q) => q.questionNumber);

      mockResults.push({
        studentName: student.name,
        studentSurname: student.surname,
        journalNumber: student.journalNumber,
        score: percentage,
        maxScore: 100,
        grade,
        feedback: `Test oceniony na podstawie klucza odpowiedzi (${totalQuestions} zadań). Dane ucznia odczytane ze skanu testu. ${incorrectQuestions.length > 0 ? `Błędne odpowiedzi w zadaniach: ${incorrectQuestions.join(", ")}.` : "Wszystkie odpowiedzi poprawne."}`,
        incorrectQuestions,
        questionDetails: questionResults,
      });
    }

    return mockResults;
  };

  const handleProcessTests = async () => {
    setErrorMessage(null);

    if (!answerKey || testScans.length === 0) {
      setErrorMessage("Proszę załadować klucz odpowiedzi i skany testów.");
      return;
    }

    if (answerKeyError || testScansError) {
      setErrorMessage(
        "Proszę naprawić błędy w załadowanych plikach przed kontynuowaniem.",
      );
      return;
    }

    setIsProcessing(true);
    setProcessingStatus(
      `Inicjalizacja ${selectedAIModel === "simulation" ? "symulacji AI" : `modelu ${selectedAIModel.toUpperCase()}`}...`,
    );

    try {
      const gradingResults = await simulateOCRAndGrading();
      setProcessingStatus("");

      toast({
        title: "Ocenianie zakończone",
        description: `Przetworzono ${gradingResults.length} testów.`,
      });

      // Navigate to results page with data
      navigate("/results", { state: { results: gradingResults } });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Wystąpił błąd podczas oceniania testów.",
      );
      setProcessingStatus("");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            AI Asystent Oceniania
          </h1>
          <p className="text-lg text-gray-600">
            Automatyczne ocenianie sprawdzianów z wykorzystaniem sztucznej
            inteligencji
          </p>
          {selectedAIModel === "simulation" && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl mx-auto">
              <p className="text-sm text-blue-800">
                <strong>Uwaga:</strong> Obecnie używany jest tryb symulacji AI.
                Wyniki są generowane losowo w celach demonstracyjnych.
              </p>
            </div>
          )}
        </div>

        {/* AI Model Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Model AI</CardTitle>
            <CardDescription>
              Wybierz model sztucznej inteligencji do oceniania testów
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="gpt-4"
                  name="aiModel"
                  value="gpt-4"
                  checked={selectedAIModel === "gpt-4"}
                  onChange={(e) =>
                    setSelectedAIModel(e.target.value as AIModelType)
                  }
                  className="w-4 h-4 text-blue-600"
                  disabled
                />
                <Label htmlFor="gpt-4" className="cursor-pointer text-gray-400">
                  GPT-4 (niedostępny)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="claude-3"
                  name="aiModel"
                  value="claude-3"
                  checked={selectedAIModel === "claude-3"}
                  onChange={(e) =>
                    setSelectedAIModel(e.target.value as AIModelType)
                  }
                  className="w-4 h-4 text-blue-600"
                  disabled
                />
                <Label
                  htmlFor="claude-3"
                  className="cursor-pointer text-gray-400"
                >
                  Claude-3 (niedostępny)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="gemini-pro"
                  name="aiModel"
                  value="gemini-pro"
                  checked={selectedAIModel === "gemini-pro"}
                  onChange={(e) =>
                    setSelectedAIModel(e.target.value as AIModelType)
                  }
                  className="w-4 h-4 text-blue-600"
                  disabled
                />
                <Label
                  htmlFor="gemini-pro"
                  className="cursor-pointer text-gray-400"
                >
                  Gemini Pro (niedostępny)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="simulation"
                  name="aiModel"
                  value="simulation"
                  checked={selectedAIModel === "simulation"}
                  onChange={(e) =>
                    setSelectedAIModel(e.target.value as AIModelType)
                  }
                  className="w-4 h-4 text-blue-600"
                />
                <Label htmlFor="simulation" className="cursor-pointer">
                  Symulacja AI (dostępny)
                </Label>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Informacja:</strong> Obecnie dostępny jest tylko tryb
                symulacji. Prawdziwe modele AI wymagają konfiguracji API i
                kluczy dostępu.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Student Identifier Type Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Typ identyfikatora ucznia</CardTitle>
            <CardDescription>
              Wybierz, jakiego typu informacje o uczniu AI ma szukać w górnych
              rogach testów
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="journal"
                  name="studentIdentifier"
                  value="journal"
                  checked={studentIdentifierType === "journal"}
                  onChange={(e) =>
                    setStudentIdentifierType(
                      e.target.value as StudentIdentifierType,
                    )
                  }
                  className="w-4 h-4 text-blue-600"
                />
                <Label htmlFor="journal" className="cursor-pointer">
                  Tylko numer z dziennika
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="name"
                  name="studentIdentifier"
                  value="name"
                  checked={studentIdentifierType === "name"}
                  onChange={(e) =>
                    setStudentIdentifierType(
                      e.target.value as StudentIdentifierType,
                    )
                  }
                  className="w-4 h-4 text-blue-600"
                />
                <Label htmlFor="name" className="cursor-pointer">
                  Tylko imię i nazwisko
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="both"
                  name="studentIdentifier"
                  value="both"
                  checked={studentIdentifierType === "both"}
                  onChange={(e) =>
                    setStudentIdentifierType(
                      e.target.value as StudentIdentifierType,
                    )
                  }
                  className="w-4 h-4 text-blue-600"
                />
                <Label htmlFor="both" className="cursor-pointer">
                  Imię, nazwisko i numer z dziennika
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Section */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Klucz Odpowiedzi
              </CardTitle>
              <CardDescription>
                Załaduj plik z prawidłowymi odpowiedziami. Każde zadanie musi
                mieć wyraźny numer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <Label htmlFor="answer-key" className="cursor-pointer">
                    <span className="text-sm text-gray-600">
                      Kliknij aby wybrać plik lub przeciągnij tutaj
                    </span>
                  </Label>
                  <Input
                    id="answer-key"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.png"
                    onChange={handleAnswerKeyUpload}
                    className="hidden"
                  />
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
                Załaduj skany prac uczniów. Każdy plik będzie traktowany jako
                osobny uczeń. Możesz dodać wiele plików naraz. Każdy test musi
                zawierać czytelnie napisane informacje o uczniu w górnych rogach
                (zgodnie z wybranym typem identyfikatora).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <Label htmlFor="test-scans" className="cursor-pointer">
                    <span className="text-sm text-gray-600">
                      Wybierz skany testów (JPG, PNG, JFIF, PDF)
                    </span>
                  </Label>
                  <Input
                    id="test-scans"
                    type="file"
                    accept=".jpg,.jpeg,.png,.jfif,.pdf"
                    multiple
                    onChange={handleTestScansUpload}
                    className="hidden"
                  />
                </div>
                {testScans.length > 0 && !testScansError && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Załadowano {testScans.length} plików
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {testScans.map((studentFile, index) => (
                        <div
                          key={index}
                          className="text-xs text-gray-600 flex justify-between"
                        >
                          <span>{studentFile.file.name}</span>
                          <span className="text-blue-600">
                            ID: {studentFile.studentId}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestScans([])}
                      className="text-xs"
                    >
                      Wyczyść wszystkie
                    </Button>
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

        {/* Grading Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle>Progi Punktowe</CardTitle>
            <CardDescription>
              Ustaw progi punktowe dla poszczególnych ocen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label htmlFor="celujacy">Celujący (%)</Label>
                <Input
                  id="celujacy"
                  type="number"
                  value={thresholds.celujacy}
                  onChange={(e) =>
                    setThresholds({
                      ...thresholds,
                      celujacy: Number(e.target.value),
                    })
                  }
                  min="0"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bardzoDobrzy">Bardzo dobry (%)</Label>
                <Input
                  id="bardzoDobrzy"
                  type="number"
                  value={thresholds.bardzoDobrzy}
                  onChange={(e) =>
                    setThresholds({
                      ...thresholds,
                      bardzoDobrzy: Number(e.target.value),
                    })
                  }
                  min="0"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dobry">Dobry (%)</Label>
                <Input
                  id="dobry"
                  type="number"
                  value={thresholds.dobry}
                  onChange={(e) =>
                    setThresholds({
                      ...thresholds,
                      dobry: Number(e.target.value),
                    })
                  }
                  min="0"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dostateczny">Dostateczny (%)</Label>
                <Input
                  id="dostateczny"
                  type="number"
                  value={thresholds.dostateczny}
                  onChange={(e) =>
                    setThresholds({
                      ...thresholds,
                      dostateczny: Number(e.target.value),
                    })
                  }
                  min="0"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dopuszczajacy">Dopuszczający (%)</Label>
                <Input
                  id="dopuszczajacy"
                  type="number"
                  value={thresholds.dopuszczajacy}
                  onChange={(e) =>
                    setThresholds({
                      ...thresholds,
                      dopuszczajacy: Number(e.target.value),
                    })
                  }
                  min="0"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="niedostateczny">Niedostateczny (%)</Label>
                <Input
                  id="niedostateczny"
                  type="number"
                  value={thresholds.niedostateczny}
                  onChange={(e) =>
                    setThresholds({
                      ...thresholds,
                      niedostateczny: Number(e.target.value),
                    })
                  }
                  min="0"
                  max="100"
                  disabled
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Process Button */}
        <div className="text-center">
          <Button
            onClick={handleProcessTests}
            disabled={
              isProcessing ||
              !answerKey ||
              testScans.length === 0 ||
              !!answerKeyError ||
              !!testScansError
            }
            size="lg"
            className="px-8 py-3"
          >
            {isProcessing ? (
              <>
                <Brain className="h-5 w-5 mr-2 animate-spin" />
                Przetwarzanie...
              </>
            ) : (
              <>
                <Brain className="h-5 w-5 mr-2" />
                {selectedAIModel === "simulation"
                  ? "Rozpocznij Symulację AI"
                  : `Rozpocznij Ocenianie (${selectedAIModel.toUpperCase()})`}
              </>
            )}
          </Button>
          {processingStatus && (
            <p className="mt-2 text-sm text-gray-600">{processingStatus}</p>
          )}
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
