# Footnote – Beispieldokument

Dies ist ein Beispieldokument für die Ingestion-Engine von Footnote. Es dient
ausschließlich dazu, die Pipeline aus Extrahieren, Chunking, Embedding und
Speichern gegen eine echte Datenbank und die Gemini-API zu testen. Der Inhalt
ist absichtlich etwas länger, damit beim Chunking mehr als ein Stück entsteht.

## Was ist Footnote?

Footnote ist ein RAG-Wissensassistent. RAG steht für "Retrieval-Augmented
Generation": Statt eine Frage allein aus dem Modellwissen zu beantworten, sucht
das System zuerst passende Stellen in einer Wissensbasis und formuliert die
Antwort dann ausschließlich auf Grundlage dieser gefundenen Stellen. Der
entscheidende Unterschied zu einem reinen Chatbot ist, dass jede Aussage mit
ihrer Quelle belegt wird. Findet sich nichts Passendes, sagt Footnote offen,
dass die Information nicht in der Wissensbasis steht, anstatt zu raten.

## Wie funktioniert die Ingestion?

Die Ingestion ist der Vorgang, mit dem Dokumente in die Wissensbasis gelangen.
Zuerst wird der rohe Dateiinhalt in reinen Text umgewandelt. Für Markdown- und
Textdateien bedeutet das schlicht ein Dekodieren als UTF-8. Andere Formate wie
PDF folgen in einem späteren Schritt und sind aktuell bewusst noch nicht
unterstützt.

Anschließend wird der Text in überschaubare Stücke geschnitten, die man Chunks
nennt. Jeder Chunk ist klein genug, um vom Embedding-Modell verarbeitet zu
werden, und groß genug, um genügend Kontext für eine sinnvolle Antwort zu
enthalten. Benachbarte Chunks überlappen sich leicht, damit an den Schnittkanten
keine Information verloren geht.

## Embeddings und Vektoren

Für jeden Chunk berechnet das System ein sogenanntes Embedding. Ein Embedding
ist ein Vektor aus vielen Zahlen, der die Bedeutung des Textes in einer Form
ausdrückt, die sich mathematisch vergleichen lässt. Texte mit ähnlicher
Bedeutung liegen im Vektorraum nah beieinander. Genau diese Nähe nutzt Footnote
später, um zu einer Frage die passenden Chunks zu finden.

Wichtig ist, dass durchgängig dasselbe Embedding-Modell verwendet wird. Vektoren
unterschiedlicher Modelle sind nicht miteinander vergleichbar, weil sie den
Bedeutungsraum unterschiedlich aufspannen. Deshalb sind Modell und Vektor-Länge
an genau einer Stelle im Code festgelegt.

## Speichern in einer Transaktion

Zum Schluss werden das Dokument und alle zugehörigen Chunks gespeichert. Das
geschieht in einer einzigen Transaktion nach dem Prinzip alles-oder-nichts:
Entweder landen das Dokument und sämtliche Chunks vollständig in der Datenbank,
oder im Fehlerfall gar nichts. So kann es niemals ein Dokument ohne seine Chunks
oder Chunks ohne ihr Dokument geben. Eine Prüfsumme über den Inhalt sorgt zudem
dafür, dass ein bereits vorhandenes Dokument nicht doppelt eingelesen wird.

## Warum Quellenangaben wichtig sind

Sprachmodelle neigen dazu, plausibel klingende, aber falsche Aussagen zu
erzeugen. In einer Wissensbasis mit interner Dokumentation kann das teuer
werden, etwa wenn eine erfundene Konfigurationsoption übernommen wird. Footnote
begegnet dem, indem jede Antwort an konkrete Textstellen gebunden ist. Wer die
Antwort liest, kann jederzeit zur Originalstelle springen und nachprüfen, ob die
Aussage trägt. Vertrauen entsteht so nicht durch den Tonfall der Antwort,
sondern durch die Möglichkeit der Überprüfung.

## Grenzen des Systems

Footnote ist nur so gut wie seine Wissensbasis. Steht eine Information nirgends
in den eingelesenen Dokumenten, kann und soll das System sie nicht erfinden. In
solchen Fällen ist die richtige Antwort, ehrlich auf die Lücke hinzuweisen.
Ebenso gilt: veraltete Dokumente führen zu veralteten Antworten. Die Pflege der
Wissensbasis ist daher kein einmaliger Vorgang, sondern eine laufende Aufgabe.
Wer Dokumente aktualisiert, sollte die betroffenen Stellen neu einlesen, damit
die Embeddings den aktuellen Stand widerspiegeln.

## Ausblick

Die hier beschriebene Ingestion ist der erste Baustein. Darauf aufbauend folgen
die Ähnlichkeitssuche über die gespeicherten Vektoren und die eigentliche
Antwort-Generierung mit Quellenangabe. Erst im Zusammenspiel dieser Teile wird
aus einer Sammlung von Vektoren ein nützlicher Wissensassistent. Dieses
Beispieldokument bleibt dabei bewusst schlicht und dient allein dazu, die
Pipeline von Anfang bis Ende einmal durchlaufen zu lassen.
